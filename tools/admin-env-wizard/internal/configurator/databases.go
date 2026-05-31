package configurator

import (
	"fmt"
	"sort"
	"strings"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
)

type DeploymentDatabaseSlot struct {
	ID            string `yaml:"id"`
	Infra         string `yaml:"infra"`
	ProvisionMode string `yaml:"provisionMode,omitempty"`
	Host          string `yaml:"host,omitempty"`
	Port          int    `yaml:"port,omitempty"`
	DatabaseName  string `yaml:"databaseName,omitempty"`
	Username      string `yaml:"username,omitempty"`
	PasswordKey   string `yaml:"passwordKey,omitempty"`
	Create        bool   `yaml:"create,omitempty"`
	Migrate       bool   `yaml:"migrate,omitempty"`
	Seed          bool   `yaml:"seed,omitempty"`
}

type DeploymentServiceDatabase struct {
	SlotID       string `yaml:"slotId,omitempty"`
	DatabaseName string `yaml:"databaseName,omitempty"`
	Username     string `yaml:"username,omitempty"`
	PasswordKey  string `yaml:"passwordKey,omitempty"`
}

type DeploymentService struct {
	ServiceID string                     `yaml:"serviceId"`
	Enabled   bool                       `yaml:"enabled"`
	Replicas  int                        `yaml:"replicas,omitempty"`
	ImageTag  string                     `yaml:"imageTag,omitempty"`
	Database  *DeploymentServiceDatabase `yaml:"database,omitempty"`
}

type ResolvedServiceDatabaseBinding struct {
	ServiceID      string
	Infra          domain.InfraKind
	SlotID         string
	ProvisionMode  domain.DatabaseProvisionMode
	Host           string
	Port           int
	DatabaseName   string
	Username       string
	PasswordKey    string
	Inherited      bool
	Create         bool
	Migrate        bool
	Seed           bool
	Required       bool
	MissingSlot    bool
	MissingSecrets []string
}

type DatabaseSlotReadiness struct {
	Slot             domain.DatabaseSlot
	AttachedServices []string
	Ready            bool
	Summary          string
	Warnings         []string
}

type DatabaseReadinessReport struct {
	Slots            []DatabaseSlotReadiness
	ServiceBindings  []ResolvedServiceDatabaseBinding
	Warnings         []string
	DBSetupSummaries []string
}

func EnsureDeploymentDatabaseState(doc *DeploymentConfig, cat *catalog.Catalog) {
	if doc == nil {
		return
	}
	if cat == nil {
		cat = catalog.DefaultCatalog()
	}

	enabledSet := enabledServiceSet(doc)
	serviceDetails := serviceDetailMap(doc)
	requiredInfra := requiredDatabaseInfra(doc, cat)

	slotMap := map[string]DeploymentDatabaseSlot{}
	for _, slot := range doc.Databases {
		normalized := normalizeDeploymentDatabaseSlot(slot)
		slotMap[normalized.ID] = normalized
		requiredInfra[domain.InfraKind(normalized.Infra)] = true
	}
	for kind := range requiredInfra {
		id := defaultDatabaseSlotID(kind)
		if _, exists := slotMap[id]; !exists {
			slotMap[id] = normalizeDeploymentDatabaseSlot(DeploymentDatabaseSlot{
				ID:            id,
				Infra:         string(kind),
				ProvisionMode: string(domain.DatabaseProvisionManaged),
				Host:          defaultDatabaseHost(kind),
				Port:          defaultDatabasePort(kind),
				DatabaseName:  defaultDatabaseName(doc, kind),
				Username:      defaultDatabaseUsername(kind),
				PasswordKey:   defaultDatabasePasswordKey(kind),
				Create:        kind == domain.InfraPostgres,
				Migrate:       kind == domain.InfraPostgres,
				Seed:          false,
			})
		}
	}
	doc.Databases = sortDeploymentSlots(slotMap)

	serviceIDs := orderedEnabledServices(doc, serviceDetails, enabledSet)
	services := make([]DeploymentService, 0, len(serviceIDs))
	for _, serviceID := range serviceIDs {
		detail, ok := serviceDetails[serviceID]
		if !ok {
			detail = DeploymentService{ServiceID: serviceID, Enabled: true}
		}
		detail.ServiceID = serviceID
		detail.Enabled = enabledSet[serviceID]
		detail.Database = normalizeServiceDatabase(detail.Database, requiredServiceDatabaseKinds(serviceID, cat))
		services = append(services, detail)
	}
	doc.Services = services
}

func BuildDatabaseReadiness(doc *DeploymentConfig, cat *catalog.Catalog, secrets map[string]string) DatabaseReadinessReport {
	if cat == nil {
		cat = catalog.DefaultCatalog()
	}
	EnsureDeploymentDatabaseState(doc, cat)

	slots := make(map[string]domain.DatabaseSlot, len(doc.Databases))
	for _, slot := range doc.Databases {
		normalized := normalizeDeploymentDatabaseSlot(slot)
		slots[normalized.ID] = deploymentSlotToDomain(normalized)
	}

	attachments := map[string][]string{}
	bindings := make([]ResolvedServiceDatabaseBinding, 0)
	warnings := make([]string, 0)
	for _, service := range doc.Services {
		if !service.Enabled {
			continue
		}
		for _, kind := range requiredServiceDatabaseKinds(service.ServiceID, cat) {
			binding := resolveServiceDatabaseBinding(service, kind, slots)
			bindings = append(bindings, binding)
			if binding.SlotID != "" {
				attachments[binding.SlotID] = append(attachments[binding.SlotID], service.ServiceID)
			}
			if binding.MissingSlot {
				warnings = append(warnings, fmt.Sprintf("service %s is missing a %s database slot", service.ServiceID, kind))
			}
			for _, key := range binding.MissingSecrets {
				warnings = append(warnings, fmt.Sprintf("service %s is missing secret %s for database slot %s", service.ServiceID, key, binding.SlotID))
			}
		}
	}

	slotReports := make([]DatabaseSlotReadiness, 0, len(doc.Databases))
	dbSetup := make([]string, 0, len(doc.Databases))
	for _, slot := range doc.Databases {
		domainSlot := deploymentSlotToDomain(slot)
		attached := append([]string(nil), attachments[slot.ID]...)
		sort.Strings(attached)
		ready := true
		slotWarnings := make([]string, 0)
		if domainSlot.ProvisionMode == domain.DatabaseProvisionExternal && strings.TrimSpace(domainSlot.Host) == "" {
			ready = false
			slotWarnings = append(slotWarnings, "external slots require a host")
		}
		if domainSlot.Port == 0 {
			ready = false
			slotWarnings = append(slotWarnings, "slot port must be set")
		}
		if domainSlot.PasswordKey == "" {
			ready = false
			slotWarnings = append(slotWarnings, "slot passwordKey must be set")
		}
		summary := fmt.Sprintf("%s slot (%s) attached to %d service(s)", slot.ID, slot.Infra, len(attached))
		if domainSlot.Create || domainSlot.Migrate || domainSlot.Seed {
			summary = fmt.Sprintf("%s; db-setup create=%t migrate=%t seed=%t", summary, domainSlot.Create, domainSlot.Migrate, domainSlot.Seed)
		}
		slotReports = append(slotReports, DatabaseSlotReadiness{
			Slot:             domainSlot,
			AttachedServices: attached,
			Ready:            ready && len(slotWarnings) == 0,
			Summary:          summary,
			Warnings:         slotWarnings,
		})
		dbSetup = append(dbSetup, fmt.Sprintf("%s: %s@%s:%d create=%t migrate=%t seed=%t", slot.ID, fallbackString(slot.DatabaseName, defaultDatabaseName(doc, domain.InfraKind(slot.Infra))), fallbackString(slot.Host, defaultDatabaseHost(domain.InfraKind(slot.Infra))), slot.Port, slot.Create, slot.Migrate, slot.Seed))
	}
	return DatabaseReadinessReport{Slots: slotReports, ServiceBindings: bindings, Warnings: warnings, DBSetupSummaries: dbSetup}
}

func slotAttachments(report DatabaseReadinessReport, slotID string) []string {
	for _, slot := range report.Slots {
		if slot.Slot.ID == slotID {
			return append([]string(nil), slot.AttachedServices...)
		}
	}
	return nil
}

func ResolveEnvironmentDatabaseBindings(env *domain.EnvironmentDefinition) []ResolvedServiceDatabaseBinding {
	if env == nil {
		return nil
	}
	slots := map[string]domain.DatabaseSlot{}
	for _, slot := range env.DatabaseSlots {
		slots[slot.ID] = slot
	}
	bindings := make([]ResolvedServiceDatabaseBinding, 0)
	for _, service := range env.Services {
		if !service.Enabled || service.DatabaseBinding == nil {
			continue
		}
		binding := ResolvedServiceDatabaseBinding{
			ServiceID:    service.ServiceID,
			Infra:        service.DatabaseBinding.Infra,
			SlotID:       service.DatabaseBinding.SlotID,
			DatabaseName: service.DatabaseBinding.DatabaseName,
			Username:     service.DatabaseBinding.Username,
			PasswordKey:  service.DatabaseBinding.PasswordKey,
			Inherited:    service.DatabaseBinding.Shared,
			Required:     true,
		}
		if slot, ok := slots[binding.SlotID]; ok {
			binding.ProvisionMode = slot.ProvisionMode
			binding.Host = slot.Host
			binding.Port = slot.Port
			binding.Create = slot.Create
			binding.Migrate = slot.Migrate
			binding.Seed = slot.Seed
			if binding.DatabaseName == "" {
				binding.DatabaseName = slot.DatabaseName
			}
			if binding.Username == "" {
				binding.Username = slot.Username
			}
			if binding.PasswordKey == "" {
				binding.PasswordKey = slot.PasswordKey
			}
		} else {
			binding.MissingSlot = true
		}
		bindings = append(bindings, binding)
	}
	return bindings
}

func deploymentSlotToDomain(slot DeploymentDatabaseSlot) domain.DatabaseSlot {
	slot = normalizeDeploymentDatabaseSlot(slot)
	return domain.DatabaseSlot{
		ID:            slot.ID,
		Infra:         domain.InfraKind(slot.Infra),
		ProvisionMode: domain.DatabaseProvisionMode(slot.ProvisionMode),
		Host:          slot.Host,
		Port:          slot.Port,
		DatabaseName:  slot.DatabaseName,
		Username:      slot.Username,
		PasswordKey:   slot.PasswordKey,
		Create:        slot.Create,
		Migrate:       slot.Migrate,
		Seed:          slot.Seed,
	}
}

func domainSlotToDeployment(slot domain.DatabaseSlot) DeploymentDatabaseSlot {
	if slot.ProvisionMode == "" {
		slot.ProvisionMode = domain.DatabaseProvisionManaged
	}
	return DeploymentDatabaseSlot{
		ID:            slot.ID,
		Infra:         string(slot.Infra),
		ProvisionMode: string(slot.ProvisionMode),
		Host:          slot.Host,
		Port:          slot.Port,
		DatabaseName:  slot.DatabaseName,
		Username:      slot.Username,
		PasswordKey:   slot.PasswordKey,
		Create:        slot.Create,
		Migrate:       slot.Migrate,
		Seed:          slot.Seed,
	}
}

func deploymentServiceToDomain(service DeploymentService) domain.ServiceSelection {
	selection := domain.ServiceSelection{
		ServiceID: service.ServiceID,
		Enabled:   service.Enabled,
		Replicas:  service.Replicas,
		ImageTag:  service.ImageTag,
	}
	if service.Database != nil {
		selection.DatabaseBinding = &domain.DatabaseBinding{
			SlotID:       service.Database.SlotID,
			DatabaseName: service.Database.DatabaseName,
			Username:     service.Database.Username,
			PasswordKey:  service.Database.PasswordKey,
			Shared:       strings.TrimSpace(service.Database.SlotID) == "",
		}
	}
	return selection
}

func domainServiceToDeployment(service domain.ServiceSelection) DeploymentService {
	result := DeploymentService{
		ServiceID: service.ServiceID,
		Enabled:   service.Enabled,
		Replicas:  service.Replicas,
		ImageTag:  service.ImageTag,
	}
	if service.DatabaseBinding != nil {
		result.Database = &DeploymentServiceDatabase{
			SlotID:       service.DatabaseBinding.SlotID,
			DatabaseName: service.DatabaseBinding.DatabaseName,
			Username:     service.DatabaseBinding.Username,
			PasswordKey:  service.DatabaseBinding.PasswordKey,
		}
	}
	return result
}

func resolveServiceDatabaseBinding(service DeploymentService, kind domain.InfraKind, slots map[string]domain.DatabaseSlot) ResolvedServiceDatabaseBinding {
	slotID := defaultDatabaseSlotID(kind)
	inherited := true
	if service.Database != nil && strings.TrimSpace(service.Database.SlotID) != "" {
		slotID = strings.TrimSpace(service.Database.SlotID)
		inherited = false
	}
	binding := ResolvedServiceDatabaseBinding{
		ServiceID: service.ServiceID,
		Infra:     kind,
		SlotID:    slotID,
		Inherited: inherited,
		Required:  true,
	}
	slot, ok := slots[slotID]
	if !ok {
		binding.MissingSlot = true
		return binding
	}
	binding.ProvisionMode = slot.ProvisionMode
	binding.Host = slot.Host
	binding.Port = slot.Port
	binding.Create = slot.Create
	binding.Migrate = slot.Migrate
	binding.Seed = slot.Seed
	binding.DatabaseName = slot.DatabaseName
	binding.Username = slot.Username
	binding.PasswordKey = slot.PasswordKey
	if service.Database != nil {
		if value := strings.TrimSpace(service.Database.DatabaseName); value != "" {
			binding.DatabaseName = value
		}
		if value := strings.TrimSpace(service.Database.Username); value != "" {
			binding.Username = value
		}
		if value := strings.TrimSpace(service.Database.PasswordKey); value != "" {
			binding.PasswordKey = value
		}
	}
	if binding.PasswordKey == "" {
		binding.MissingSecrets = append(binding.MissingSecrets, defaultDatabasePasswordKey(kind))
	}
	return binding
}

func requiredDatabaseInfra(doc *DeploymentConfig, cat *catalog.Catalog) map[domain.InfraKind]bool {
	infra := map[domain.InfraKind]bool{}
	for _, item := range doc.Environment.Infra {
		infra[domain.InfraKind(item)] = true
	}
	for _, service := range doc.Environment.Services {
		for _, kind := range requiredServiceDatabaseKinds(service, cat) {
			infra[kind] = true
		}
	}
	return infra
}

func requiredServiceDatabaseKinds(serviceID string, cat *catalog.Catalog) []domain.InfraKind {
	preset, ok := cat.Get(serviceID)
	if !ok {
		return nil
	}
	kinds := make([]domain.InfraKind, 0)
	seen := map[domain.InfraKind]struct{}{}
	for _, dep := range preset.Dependencies {
		if dep.Database == "" {
			continue
		}
		if _, exists := seen[dep.Database]; exists {
			continue
		}
		seen[dep.Database] = struct{}{}
		kinds = append(kinds, dep.Database)
	}
	sort.Slice(kinds, func(i, j int) bool { return kinds[i] < kinds[j] })
	return kinds
}

func normalizeDeploymentDatabaseSlot(slot DeploymentDatabaseSlot) DeploymentDatabaseSlot {
	slot.ID = strings.TrimSpace(slot.ID)
	slot.Infra = strings.TrimSpace(slot.Infra)
	if slot.ProvisionMode == "" {
		slot.ProvisionMode = string(domain.DatabaseProvisionManaged)
	}
	if slot.Host == "" && slot.ProvisionMode == string(domain.DatabaseProvisionManaged) {
		slot.Host = defaultDatabaseHost(domain.InfraKind(slot.Infra))
	}
	if slot.Port == 0 {
		slot.Port = defaultDatabasePort(domain.InfraKind(slot.Infra))
	}
	if slot.Username == "" {
		slot.Username = defaultDatabaseUsername(domain.InfraKind(slot.Infra))
	}
	if slot.PasswordKey == "" {
		slot.PasswordKey = defaultDatabasePasswordKey(domain.InfraKind(slot.Infra))
	}
	return slot
}

func normalizeServiceDatabase(database *DeploymentServiceDatabase, required []domain.InfraKind) *DeploymentServiceDatabase {
	if database == nil {
		if len(required) == 0 {
			return nil
		}
		return &DeploymentServiceDatabase{SlotID: defaultDatabaseSlotID(required[0])}
	}
	if database.SlotID == "" && len(required) > 0 {
		database.SlotID = defaultDatabaseSlotID(required[0])
	}
	return database
}

func enabledServiceSet(doc *DeploymentConfig) map[string]bool {
	set := make(map[string]bool, len(doc.Environment.Services))
	for _, serviceID := range doc.Environment.Services {
		set[serviceID] = true
	}
	for _, service := range doc.Services {
		if service.Enabled {
			set[service.ServiceID] = true
		}
	}
	return set
}

func serviceDetailMap(doc *DeploymentConfig) map[string]DeploymentService {
	result := make(map[string]DeploymentService, len(doc.Services))
	for _, service := range doc.Services {
		result[service.ServiceID] = service
	}
	return result
}

func orderedEnabledServices(doc *DeploymentConfig, details map[string]DeploymentService, enabled map[string]bool) []string {
	seen := map[string]struct{}{}
	ids := make([]string, 0, len(enabled))
	for _, serviceID := range doc.Environment.Services {
		if !enabled[serviceID] {
			continue
		}
		if _, exists := seen[serviceID]; exists {
			continue
		}
		seen[serviceID] = struct{}{}
		ids = append(ids, serviceID)
	}
	for serviceID, detail := range details {
		if !detail.Enabled {
			continue
		}
		if _, exists := seen[serviceID]; exists {
			continue
		}
		seen[serviceID] = struct{}{}
		ids = append(ids, serviceID)
	}
	sort.Strings(ids)
	return ids
}

func sortDeploymentSlots(slotMap map[string]DeploymentDatabaseSlot) []DeploymentDatabaseSlot {
	ids := make([]string, 0, len(slotMap))
	for id := range slotMap {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	slots := make([]DeploymentDatabaseSlot, 0, len(ids))
	for _, id := range ids {
		slots = append(slots, slotMap[id])
	}
	return slots
}

func defaultDatabaseSlotID(kind domain.InfraKind) string {
	if kind == "" {
		return "database-primary"
	}
	return fmt.Sprintf("%s-primary", kind)
}

func defaultDatabaseHost(kind domain.InfraKind) string {
	switch kind {
	case domain.InfraPostgres:
		return "db"
	case domain.InfraRedis:
		return "redis"
	case domain.InfraSeaweedFS:
		return "seaweedfs"
	default:
		return string(kind)
	}
}

func defaultDatabasePort(kind domain.InfraKind) int {
	switch kind {
	case domain.InfraPostgres:
		return 5432
	case domain.InfraRedis:
		return 6379
	case domain.InfraSeaweedFS:
		return 8333
	default:
		return 0
	}
}

func defaultDatabaseName(doc *DeploymentConfig, kind domain.InfraKind) string {
	switch kind {
	case domain.InfraPostgres:
		if doc != nil && strings.TrimSpace(doc.Environment.Name) != "" {
			return strings.ReplaceAll(doc.Environment.Name, "-", "_")
		}
		return "postgres"
	case domain.InfraRedis:
		return "0"
	default:
		return string(kind)
	}
}

func defaultDatabaseUsername(kind domain.InfraKind) string {
	switch kind {
	case domain.InfraPostgres:
		return "postgres"
	default:
		return "default"
	}
}

func defaultDatabasePasswordKey(kind domain.InfraKind) string {
	switch kind {
	case domain.InfraPostgres:
		return "POSTGRES_PASSWORD"
	case domain.InfraRedis:
		return "REDIS_PASSWORD"
	default:
		return strings.ToUpper(strings.ReplaceAll(string(kind), "-", "_")) + "_PASSWORD"
	}
}

func fallbackString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

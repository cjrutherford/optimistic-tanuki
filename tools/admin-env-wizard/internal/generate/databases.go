package generate

import (
	"fmt"
	"strings"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
)

func findServiceSelection(env *domain.EnvironmentDefinition, serviceID string) *domain.ServiceSelection {
	if env == nil {
		return nil
	}
	for i := range env.Services {
		if env.Services[i].ServiceID == serviceID {
			return &env.Services[i]
		}
	}
	return nil
}

func findDatabaseSlot(env *domain.EnvironmentDefinition, slotID string) *domain.DatabaseSlot {
	if env == nil {
		return nil
	}
	for i := range env.DatabaseSlots {
		if env.DatabaseSlots[i].ID == slotID {
			return &env.DatabaseSlots[i]
		}
	}
	return nil
}

func applyServiceDatabaseEnv(envMap map[string]string, env *domain.EnvironmentDefinition, selection *domain.ServiceSelection) map[string]string {
	if envMap == nil {
		envMap = map[string]string{}
	}
	if selection == nil || selection.DatabaseBinding == nil {
		return envMap
	}
	binding := selection.DatabaseBinding
	slot := findDatabaseSlot(env, binding.SlotID)
	if slot == nil {
		return envMap
	}
	name := firstNonEmpty(binding.DatabaseName, slot.DatabaseName)
	username := firstNonEmpty(binding.Username, slot.Username)
	passwordKey := firstNonEmpty(binding.PasswordKey, slot.PasswordKey)
	servicePrefix := strings.ToUpper(strings.ReplaceAll(selection.ServiceID, "-", "_"))
	envMap[servicePrefix+"_DB_SLOT"] = slot.ID
	envMap[servicePrefix+"_DB_HOST"] = slot.Host
	envMap[servicePrefix+"_DB_PORT"] = fmt.Sprintf("%d", slot.Port)
	envMap[servicePrefix+"_DB_NAME"] = name
	envMap[servicePrefix+"_DB_USER"] = username
	envMap[servicePrefix+"_DB_PASSWORD_KEY"] = passwordKey
	envMap[servicePrefix+"_DB_PROVISION_MODE"] = string(slot.ProvisionMode)
	switch slot.Infra {
	case domain.InfraPostgres:
		envMap["POSTGRES_HOST"] = slot.Host
		envMap["POSTGRES_PORT"] = fmt.Sprintf("%d", slot.Port)
		envMap["POSTGRES_DB"] = name
		envMap["POSTGRES_USER"] = username
	case domain.InfraRedis:
		envMap["REDIS_HOST"] = slot.Host
		envMap["REDIS_PORT"] = fmt.Sprintf("%d", slot.Port)
	}
	return envMap
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

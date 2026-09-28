import { Controller, UsePipes, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { HardwareCommands } from '@optimistic-tanuki/constants';
import {
  ConfigurationDto,
  CreateHardwareOrderDto,
  AcceptCommercialQuoteDto,
  GetCommercialQuoteDto,
  ImportSupplierOffersDto,
  IssueCommercialQuoteDto,
  GenerateClientDeploymentArtifactsDto,
  SearchAmazonBusinessOffersDto,
  SaveHardwareConfigurationDto,
} from '@optimistic-tanuki/models';
import { HardwareCatalogService } from './hardware.service';
import { CommercialQuoteService } from './commercial-quote.service';
import { SupplierOfferImportService } from './supplier-offer-import.service';
import { AmazonBusinessLiveSyncService } from './amazon-business-live-sync.service';
import { ClientDeploymentArtifactService } from './client-deployment-artifact.service';

@Controller()
export class HardwareController {
  constructor(
    private readonly hardwareService: HardwareCatalogService,
    private readonly supplierOfferImportService: SupplierOfferImportService,
    private readonly commercialQuoteService: CommercialQuoteService,
    private readonly amazonBusinessLiveSyncService: AmazonBusinessLiveSyncService,
    private readonly clientDeploymentArtifactService: ClientDeploymentArtifactService
  ) {}

  @MessagePattern({ cmd: HardwareCommands.GET_CHASSIS })
  getChassis() {
    return this.hardwareService.getChassis();
  }

  @MessagePattern({ cmd: HardwareCommands.GET_CHASSIS_BY_ID })
  getChassisById(@Payload() payload: { id: string }) {
    return this.hardwareService.getChassisById(payload.id);
  }

  @MessagePattern({ cmd: HardwareCommands.GET_COMPATIBLE_COMPONENTS })
  getCompatibleComponents(@Payload() payload: { chassisId: string }) {
    return this.hardwareService.getCompatibleComponents(payload.chassisId);
  }

  @MessagePattern({ cmd: HardwareCommands.CALCULATE_PRICE })
  calculatePrice(@Payload() configuration: ConfigurationDto) {
    return this.hardwareService.calculatePrice(configuration);
  }

  @MessagePattern({ cmd: HardwareCommands.CREATE_ORDER })
  createOrder(@Payload() payload: CreateHardwareOrderDto) {
    return this.hardwareService.createOrder(payload);
  }

  @MessagePattern({ cmd: HardwareCommands.GET_ORDER })
  getOrder(@Payload() payload: { orderId: string }) {
    return this.hardwareService.getOrder(payload.orderId);
  }

  @MessagePattern({ cmd: HardwareCommands.SAVE_CONFIGURATION })
  saveConfiguration(@Payload() payload: SaveHardwareConfigurationDto) {
    return this.hardwareService.saveConfiguration(payload);
  }

  @MessagePattern({ cmd: HardwareCommands.GET_CONFIGURATION })
  getConfiguration(@Payload() payload: { configurationId: string }) {
    return this.hardwareService.getConfiguration(payload.configurationId);
  }

  @MessagePattern({ cmd: HardwareCommands.GET_TIERS })
  getTiers() {
    return this.hardwareService.getTiers();
  }

  @MessagePattern({ cmd: HardwareCommands.LIST_SUPPLIER_OFFERS })
  listSupplierOffers() {
    return this.supplierOfferImportService.listRecentOffers();
  }

  @MessagePattern({ cmd: HardwareCommands.SEARCH_AMAZON_BUSINESS_OFFERS })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  )
  searchAmazonBusinessOffers(
    @Payload() payload: SearchAmazonBusinessOffersDto
  ) {
    return this.amazonBusinessLiveSyncService.searchAndPersist(payload);
  }

  @MessagePattern({ cmd: HardwareCommands.IMPORT_SUPPLIER_OFFERS })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  )
  importSupplierOffers(@Payload() payload: ImportSupplierOffersDto) {
    return this.supplierOfferImportService.import(payload);
  }

  @MessagePattern({ cmd: HardwareCommands.ISSUE_COMMERCIAL_QUOTE })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  )
  issueCommercialQuote(@Payload() payload: IssueCommercialQuoteDto) {
    return this.commercialQuoteService.issueQuote(payload);
  }

  @MessagePattern({ cmd: HardwareCommands.GET_COMMERCIAL_QUOTE })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  )
  getCommercialQuote(@Payload() payload: GetCommercialQuoteDto) {
    return this.commercialQuoteService.getQuote(payload.quoteId);
  }

  @MessagePattern({ cmd: HardwareCommands.ACCEPT_COMMERCIAL_QUOTE })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  )
  acceptCommercialQuote(@Payload() payload: AcceptCommercialQuoteDto) {
    return this.commercialQuoteService.acceptQuote(payload.quoteId);
  }

  @MessagePattern({
    cmd: HardwareCommands.GENERATE_CLIENT_DEPLOYMENT_ARTIFACTS,
  })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  )
  generateClientDeploymentArtifacts(
    @Payload() payload: GenerateClientDeploymentArtifactsDto
  ) {
    return this.clientDeploymentArtifactService.generate(payload);
  }

  @MessagePattern({ cmd: HardwareCommands.PROBE_OPERATOR_ACCESS })
  probeOperatorAccess() {
    return {
      available: true as const,
      service: 'system-configurator' as const,
    };
  }
}

import { CredentialVaultService } from "./configuration_v1/credentialVault";
import { DashboardService } from "./configuration_v1/dashboards";
import { ExtensionsServiceV2 } from "./environment_v2/extensions";
import { MetricService } from "./environment_v2/metrics";
import { EntityServiceV2 } from "./environment_v2/monitoredEntities";
import { SettingsService } from "./environment_v2/settings";
import { HttpClient } from "./http_client";

/**
 * Implentation of a Dynatrace Client to facilitate calls to Dynatrace APIs
 */
export class Dynatrace {
  private readonly _httpClient: HttpClient;
  public readonly extensionsV2: ExtensionsServiceV2;
  public readonly credentialVault: CredentialVaultService;
  public readonly entitiesV2: EntityServiceV2;
  public readonly metrics: MetricService;
  public readonly settings: SettingsService;
  public readonly dashboards: DashboardService;

  /**
   * @param baseUrl URL to Dynatrace Environment
   * @param apiToken API Token for this Environment
   */
  constructor(baseUrl: string, apiToken: string) {
    this._httpClient = new HttpClient(baseUrl, apiToken);
    this.extensionsV2 = new ExtensionsServiceV2(this._httpClient);
    this.credentialVault = new CredentialVaultService(this._httpClient);
    this.entitiesV2 = new EntityServiceV2(this._httpClient);
    this.metrics = new MetricService(this._httpClient);
    this.settings = new SettingsService(this._httpClient);
    this.dashboards = new DashboardService(this._httpClient);
  }
}

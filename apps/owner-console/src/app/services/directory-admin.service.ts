import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { Observable } from 'rxjs';

type Body = object;

/**
 * Every HTTP call the directory and boundary review pages make, one method per
 * call. Pages keep the response shapes they already own, so each read or write
 * takes the response type as a type argument; bodies are built by the page.
 */
@Injectable({ providedIn: 'root' })
export class DirectoryAdminService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '');

  private town(townId: string): string {
    return `${this.api}/directory/towns/${townId}`;
  }

  // Withdrawals
  listWithdrawals<T>(limit = 50): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/withdrawals?limit=${limit}`);
  }
  requestWithdrawal<T>(body: Body): Observable<T> {
    return this.http.post<T>(`${this.api}/directory/withdrawals`, body);
  }

  // Operations
  getOperationsMetrics<T>(): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/operations/metrics`);
  }
  listOperatingControls<T>(): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/operations/controls`);
  }
  setOperatingControl<T>(key: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/operations/controls/${key}`,
      body
    );
  }

  // Rights cases
  listRightsCases<T>(query: string): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/rights-cases?${query}`);
  }
  syncRightsCases<T>(body: Body): Observable<T> {
    return this.http.post<T>(`${this.api}/directory/rights-cases/sync`, body);
  }
  getRightsCase<T>(id: string): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/rights-cases/${id}`);
  }
  decideRightsCase<T>(id: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/rights-cases/${id}/decisions`,
      body
    );
  }
  undoRightsCaseDecision<T>(id: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/rights-cases/${id}/undo`,
      body
    );
  }

  // Taxonomy mappings and runs
  listTaxonomyMappings<T>(): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/taxonomy/mappings`);
  }
  listTaxonomyRuns<T>(limit = 25): Observable<T> {
    return this.http.get<T>(
      `${this.api}/directory/taxonomy/runs?limit=${limit}`
    );
  }
  installTaxonomyMappings<T>(body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/taxonomy/mappings/install`,
      body
    );
  }
  startTaxonomyRun<T>(body: Body): Observable<T> {
    return this.http.post<T>(`${this.api}/directory/taxonomy/runs`, body);
  }
  cancelTaxonomyRun<T>(runId: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/taxonomy/runs/${runId}/cancel`,
      body
    );
  }
  rollbackTaxonomyRun<T>(runId: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/taxonomy/runs/${runId}/rollback`,
      body
    );
  }

  // Taxonomy cases
  listTaxonomyCases<T>(query: string): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/taxonomy/cases?${query}`);
  }
  raiseTaxonomyCase<T>(body: Body): Observable<T> {
    return this.http.post<T>(`${this.api}/directory/taxonomy/cases`, body);
  }
  getTaxonomyCase<T>(id: string): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/taxonomy/cases/${id}`);
  }
  dismissTaxonomyCase<T>(id: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/taxonomy/cases/${id}/dismiss`,
      body
    );
  }
  decideTaxonomyCase<T>(id: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/taxonomy/cases/${id}/decisions`,
      body
    );
  }
  undoTaxonomyCaseDecision<T>(id: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/taxonomy/cases/${id}/undo`,
      body
    );
  }

  // Listing reports and suppressions
  listListingReports<T>(town: string, status: string): Observable<T> {
    return this.http.get<T>(`${this.town(town)}/listing-reports`, {
      params: { status },
    });
  }
  actOnListingReport(
    town: string,
    reportId: string,
    action: 'review' | 'decline' | 'resolve',
    body: Body
  ): Observable<unknown> {
    return this.http.post(
      `${this.town(town)}/listing-reports/${reportId}/${action}`,
      body
    );
  }
  listListingSuppressions<T>(town: string): Observable<T> {
    return this.http.get<T>(`${this.town(town)}/listing-suppressions`);
  }
  suppressListing<T = unknown>(town: string, body: Body): Observable<T> {
    return this.http.post<T>(`${this.town(town)}/listing-suppressions`, body);
  }
  liftListingSuppression<T>(
    town: string,
    suppressionId: string,
    body: Body
  ): Observable<T> {
    return this.http.post<T>(
      `${this.town(town)}/listing-suppressions/${suppressionId}/lift`,
      body
    );
  }
  searchListings<T>(town: string, q: string): Observable<T> {
    return this.http.get<T>(`${this.town(town)}/local-evaluation-listings`, {
      params: { q, identities: '1' },
    });
  }

  // Duplicate review
  listDuplicateCases<T>(town: string, query: string): Observable<T> {
    return this.http.get<T>(`${this.town(town)}/duplicate-cases?${query}`);
  }
  getDuplicateCase<T>(town: string, caseId: string): Observable<T> {
    return this.http.get<T>(`${this.town(town)}/duplicate-cases/${caseId}`);
  }
  decideDuplicateCase<T>(
    town: string,
    caseId: string,
    body: Body
  ): Observable<T> {
    return this.http.post<T>(
      `${this.town(town)}/duplicate-cases/${caseId}/decide`,
      body
    );
  }
  listDuplicateSamples<T>(town: string): Observable<T> {
    return this.http.get<T>(`${this.town(town)}/duplicate-cases/samples`);
  }
  createDuplicateSample<T>(town: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.town(town)}/duplicate-cases/samples`,
      body
    );
  }
  getDuplicateSample<T>(town: string, sampleId: string): Observable<T> {
    return this.http.get<T>(
      `${this.town(town)}/duplicate-cases/samples/${sampleId}`
    );
  }
  judgeDuplicateSample<T>(
    town: string,
    sampleId: string,
    body: Body
  ): Observable<T> {
    return this.http.post<T>(
      `${this.town(town)}/duplicate-cases/samples/${sampleId}/judge`,
      body
    );
  }

  // Business identity review
  getIdentityQueue<T>(town: string): Observable<T> {
    return this.http.get<T>(`${this.town(town)}/business-identity-review`);
  }
  recordIdentityDecision<T>(town: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.town(town)}/business-identity-review/decisions`,
      body
    );
  }
  getIdentityDetail<T>(town: string, businessId: string): Observable<T> {
    return this.http.get<T>(
      `${this.town(town)}/business-identity-review/${businessId}`
    );
  }
  undoIdentityDecision<T>(
    town: string,
    businessId: string,
    body: Body
  ): Observable<T> {
    return this.http.post<T>(
      `${this.town(town)}/business-identity-review/${businessId}/undo`,
      body
    );
  }

  // Address review
  listAddressCandidates<T>(town: string, query: string): Observable<T> {
    return this.http.get<T>(
      `${this.town(town)}/address-review-candidates?${query}`
    );
  }
  getAddressCandidate<T>(town: string, candidateId: string): Observable<T> {
    return this.http.get<T>(
      `${this.town(town)}/address-review-candidates/${candidateId}`
    );
  }
  decideAddressCandidate<T>(
    town: string,
    candidateId: string,
    body: Body
  ): Observable<T> {
    return this.http.post<T>(
      `${this.town(town)}/address-review-candidates/${candidateId}/decisions`,
      body
    );
  }
  undoAddressDecision<T>(
    town: string,
    candidateId: string,
    body: Body
  ): Observable<T> {
    return this.http.post<T>(
      `${this.town(town)}/address-review-candidates/${candidateId}/undo`,
      body
    );
  }

  // Acquisition runs
  getRunBudget<T>(): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/runs/budget`);
  }
  getRunReleases<T>(): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/runs/releases`);
  }
  actOnRelease(
    release: string,
    action: string,
    body: Body
  ): Observable<unknown> {
    return this.http.post(
      `${this.api}/directory/runs/releases/${release}/${action}`,
      body
    );
  }
  listRuns<T>(query: string): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/runs?${query}`);
  }
  getRun<T>(id: string): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/runs/${id}`);
  }
  actOnRun<T>(runId: string, action: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/runs/${runId}/${action}`,
      body
    );
  }
  importRunHistory<T>(body: Body): Observable<T> {
    return this.http.post<T>(`${this.api}/directory/runs/history/import`, body);
  }
  runTown<T>(townId: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/runs/towns/${townId}/run`,
      body
    );
  }

  // Boundary review
  getBoundaryCandidate<T>(townId: string): Observable<T> {
    return this.http.get<T>(`${this.town(townId)}/boundary-candidate`);
  }
  recordBoundaryDecision<T>(townId: string, body: Body): Observable<T> {
    return this.http.post<T>(`${this.town(townId)}/boundary-decisions`, body);
  }

  // Business link review
  listLinkRequests<T>(town: string, cursor?: string): Observable<T> {
    return this.http.get<T>(
      `${this.town(town)}/business-link-requests${
        cursor ? '?cursor=' + encodeURIComponent(cursor) : ''
      }`
    );
  }
  getLinkListing<T>(
    town: string,
    listingId: string,
    adult: boolean
  ): Observable<T> {
    return this.http.get<T>(
      `${this.town(town)}/local-evaluation-listings/${listingId}${
        adult ? '?adult=1' : ''
      }`
    );
  }
  getCommunity<T>(communityId: string): Observable<T> {
    return this.http.get<T>(`${this.api}/social/community/${communityId}`);
  }
  reviewBusinessLink<T = unknown>(
    town: string,
    listingId: string,
    body: Body
  ): Observable<T> {
    return this.http.post<T>(
      `${this.town(
        town
      )}/local-evaluation-listings/${listingId}/business-link/reviews`,
      body
    );
  }

  // Exports
  listExports<T>(limit = 50): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/exports?limit=${limit}`);
  }
  requestExport<T>(body: Body): Observable<T> {
    return this.http.post<T>(`${this.api}/directory/exports`, body);
  }
  retryExport<T>(jobId: string): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/exports/${jobId}/retry`,
      {}
    );
  }
  downloadExport(jobId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.api}/directory/exports/${jobId}/artifact`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  // Taxonomy mapping versions
  deactivateTaxonomyMapping<T>(versionId: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/taxonomy/mappings/${encodeURIComponent(
        versionId
      )}/deactivate`,
      body
    );
  }
  activateTaxonomyMapping<T>(versionId: string, body: Body): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/taxonomy/mappings/${encodeURIComponent(
        versionId
      )}/activate`,
      body
    );
  }

  // Suspended reviewed bindings
  listSuspendedBindings<T>(
    options: { townId?: string; cursor?: string; limit?: number } = {}
  ): Observable<T> {
    const q = new URLSearchParams({ state: 'suspended' });
    if (options.townId) q.set('townId', options.townId);
    if (options.cursor) q.set('cursor', options.cursor);
    if (options.limit) q.set('limit', String(options.limit));
    return this.http.get<T>(`${this.api}/directory/reviewed-bindings?${q}`);
  }
  revalidateBinding<T>(id: string): Observable<T> {
    return this.http.post<T>(
      `${this.api}/directory/reviewed-bindings/${id}/revalidate`,
      {}
    );
  }

  // Boundary lock
  getBoundaryLock<T>(townId: string): Observable<T> {
    return this.http.get<T>(`${this.town(townId)}/boundary-lock`);
  }
  lockBoundary<T>(townId: string, body: Body): Observable<T> {
    return this.http.post<T>(`${this.town(townId)}/boundary-lock`, body);
  }
  unlockBoundary<T>(townId: string, body: Body): Observable<T> {
    return this.http.post<T>(`${this.town(townId)}/boundary-unlock`, body);
  }

  // Maintenance jobs
  startRenormalizeJob<T>(body: Body): Observable<T> {
    return this.http.post<T>(`${this.api}/directory/jobs/renormalize`, body);
  }
  getJob<T>(id: string): Observable<T> {
    return this.http.get<T>(`${this.api}/directory/jobs/${id}`);
  }
}

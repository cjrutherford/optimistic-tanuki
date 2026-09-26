import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  UploadDocumentDto,
  DocumentAuditResponseDto,
  WireVerificationRequestDto,
  WireInstructionResponseDto,
  WispAuditLogDto,
  CopilotQueryDto,
  CopilotResponseDto,
} from '@optimistic-tanuki/models';

export const VAULT_STAFF_APP_SCOPE = 'finance';

const STAFF_SESSION_HEADERS = {
  'X-ot-appscope': VAULT_STAFF_APP_SCOPE,
  'X-ot-session-mode': 'cookie',
};

@Injectable({
  providedIn: 'root',
})
export class PracticeVaultApiService {
  private readonly baseUrl = '/api/v1/vault';

  constructor(private readonly http: HttpClient) {}

  uploadDocument(
    token: string,
    dto: UploadDocumentDto
  ): Observable<DocumentAuditResponseDto> {
    return this.http.post<DocumentAuditResponseDto>(
      `${this.baseUrl}/drop/${encodeURIComponent(token)}`,
      dto
    );
  }

  verifyEscrowOtp(
    token: string,
    dto: WireVerificationRequestDto
  ): Observable<WireInstructionResponseDto> {
    return this.http.post<WireInstructionResponseDto>(
      `${this.baseUrl}/escrow-verify/${encodeURIComponent(token)}`,
      dto
    );
  }

  requestEscrowSmsOtp(
    token: string,
    phoneNumber: string
  ): Observable<{ sent: boolean; expiresAt: string }> {
    return this.http.post<{ sent: boolean; expiresAt: string }>(
      `${this.baseUrl}/escrow-verify/${encodeURIComponent(token)}/sms`,
      { token, phoneNumber }
    );
  }

  getWispComplianceAudit(): Observable<WispAuditLogDto> {
    return this.http.get<WispAuditLogDto>(`${this.baseUrl}/compliance/wisp`, {
      withCredentials: true,
      headers: STAFF_SESSION_HEADERS,
    });
  }

  exportWispAudit(format: 'csv' | 'json'): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/compliance/wisp/export`, {
      params: { format },
      withCredentials: true,
      headers: STAFF_SESSION_HEADERS,
      responseType: 'blob',
    });
  }

  queryCopilot(dto: CopilotQueryDto): Observable<CopilotResponseDto> {
    return this.http.post<CopilotResponseDto>(
      `${this.baseUrl}/copilot/query`,
      dto,
      {
        withCredentials: true,
        headers: STAFF_SESSION_HEADERS,
      }
    );
  }
}

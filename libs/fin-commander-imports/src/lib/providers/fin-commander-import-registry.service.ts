import { Injectable } from '@angular/core';

export interface FinCommanderImportDraft {
  postedOn: string;
  amount: number;
  type: 'credit' | 'debit';
  category: string;
  description: string;
  payeeOrVendor?: string;
}

export interface FinCommanderImportPreview {
  providerId: string;
  title: string;
  warnings: string[];
  transactions: FinCommanderImportDraft[];
}

export interface FinCommanderImportProviderManifest {
  id: string;
  name: string;
  description: string;
  inputLabel: string;
  placeholder: string;
  inputOptional?: boolean;
}

export interface FinCommanderImportProvider {
  manifest: FinCommanderImportProviderManifest;
  preview(input: string): Promise<FinCommanderImportPreview>;
}

@Injectable({
  providedIn: 'root',
})
export class FinCommanderImportRegistryService {
  readonly manifests: FinCommanderImportProviderManifest[] = [
    {
      id: 'csv',
      name: 'CSV Intake',
      description: 'Paste exported transaction rows from a bank or card statement.',
      inputLabel: 'CSV rows',
      placeholder: 'date,description,amount,type,category',
    },
    {
      id: 'demo-bank',
      name: 'Demo Bank Feed',
      description: 'Load a mock bank feed to validate the preview-and-commit workflow.',
      inputLabel: 'Optional note',
      placeholder: 'No raw input required for the demo bank feed.',
      inputOptional: true,
    },
  ];

  async loadProvider(id: string): Promise<FinCommanderImportProvider> {
    if (id === 'csv') {
      const module = await import('./csv.provider');
      return module.csvImportProvider;
    }

    if (id === 'demo-bank') {
      const module = await import('./demo-bank.provider');
      return module.demoBankImportProvider;
    }

    throw new Error(`Unknown import provider: ${id}`);
  }
}

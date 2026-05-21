import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { LeadsComponent } from './leads.component';
import { LeadsService } from './leads.service';
import { Lead, LeadSource, LeadStatus } from './leads.types';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { ActivatedRoute } from '@angular/router';

describe('LeadsComponent', () => {
  const mockLead: Lead = {
    id: 'lead-1',
    name: 'John Doe',
    company: 'Acme Corp',
    email: 'john@acme.com',
    phone: '555-1234',
    source: LeadSource.REFERRAL,
    status: LeadStatus.NEW,
    value: 5000,
    notes: 'Interested in our services',
    nextFollowUp: undefined,
    isAutoDiscovered: false,
    searchKeywords: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const leadsServiceStub = {
    getLeads: jest.fn(),
    getStats: jest.fn(),
    createLead: jest.fn(),
    updateLead: jest.fn(),
    deleteLead: jest.fn(),
    flagLead: jest.fn(),
  };

  const themeServiceStub = {
    setPersonality: jest.fn(),
  };

  const routeStub = {
    queryParams: of({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    leadsServiceStub.getLeads.mockReturnValue(of([]));
    leadsServiceStub.getStats.mockReturnValue(
      of({
        total: 0,
        autoDiscovered: 0,
        manual: 0,
        totalValue: 0,
        followUpsDue: 0,
        byStatus: {},
        qualification: {
          byClassification: {
            'strong-match': 0,
            review: 0,
            'weak-match': 0,
          },
          averageRelevanceScore: null,
          averageDifficultyScore: null,
          averageUserFitScore: null,
          missingUserFitCount: 0,
        },
      })
    );

    await TestBed.configureTestingModule({
      imports: [LeadsComponent],
      providers: [
        { provide: LeadsService, useValue: leadsServiceStub },
        { provide: ThemeService, useValue: themeServiceStub },
        { provide: ActivatedRoute, useValue: routeStub },
      ],
    }).compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(LeadsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('create workflow', () => {
    it('shows quick add panel when clicking Quick Add button', () => {
      const fixture = TestBed.createComponent(LeadsComponent);
      fixture.detectChanges();

      expect(fixture.componentInstance.showQuickAdd).toBe(false);

      const button = fixture.debugElement.query(By.css('.btn-primary'));
      button.triggerEventHandler('click', {});
      fixture.detectChanges();

      expect(fixture.componentInstance.showQuickAdd).toBe(true);
    });

    it('calls createLead when submitting the form', () => {
      leadsServiceStub.createLead.mockReturnValue(of(mockLead));

      const fixture = TestBed.createComponent(LeadsComponent);
      fixture.detectChanges();

      fixture.componentInstance.showQuickAdd = true;
      fixture.componentInstance.newLead = {
        name: 'John Doe',
        company: 'Acme Corp',
        source: LeadSource.REFERRAL,
        status: LeadStatus.NEW,
        value: 5000,
      };

      fixture.componentInstance.createLead();
      fixture.detectChanges();

      expect(leadsServiceStub.createLead).toHaveBeenCalled();
    });

    it('submits all user-editable lead fields when creating a lead', () => {
      leadsServiceStub.createLead.mockReturnValue(of(mockLead));

      const fixture = TestBed.createComponent(LeadsComponent);
      fixture.detectChanges();

      fixture.componentInstance.newLead = {
        name: 'John Doe',
        company: 'Acme Corp',
        email: 'john@acme.com',
        phone: '555-1234',
        source: LeadSource.REFERRAL,
        status: LeadStatus.QUALIFIED,
        value: 5000,
        notes: 'Interested in our services',
        nextFollowUp: '2026-04-10',
        assignedTo: 'owner-1',
        searchKeywords: ['react', 'typescript'],
      };

      fixture.componentInstance.createLead();

      expect(leadsServiceStub.createLead).toHaveBeenCalledWith({
        name: 'John Doe',
        company: 'Acme Corp',
        email: 'john@acme.com',
        phone: '555-1234',
        source: LeadSource.REFERRAL,
        status: LeadStatus.QUALIFIED,
        value: 5000,
        notes: 'Interested in our services',
        nextFollowUp: '2026-04-10',
        assignedTo: 'owner-1',
        searchKeywords: ['react', 'typescript'],
      });
    });
  });

  describe('edit workflow', () => {
    it('has isEditingLead and editingLeadId properties', () => {
      const fixture = TestBed.createComponent(LeadsComponent);
      const component = fixture.componentInstance;

      expect(component.isEditingLead).toBe(false);
      expect(component.editingLeadId).toBeNull();
    });

    it('enters edit mode when editLead is called', () => {
      const fixture = TestBed.createComponent(LeadsComponent);
      const component = fixture.componentInstance;

      component.editLead(mockLead);

      expect(component.isEditingLead).toBe(true);
      expect(component.editingLeadId).toBe('lead-1');
    });

    it('populates the form with lead data when entering edit mode', () => {
      const fixture = TestBed.createComponent(LeadsComponent);
      const component = fixture.componentInstance;

      component.editLead(mockLead);

      expect(component.newLead.name).toBe(mockLead.name);
      expect(component.newLead.company).toBe(mockLead.company);
      expect(component.newLead.email).toBe(mockLead.email);
      expect(component.newLead.phone).toBe(mockLead.phone);
      expect(component.newLead.source).toBe(mockLead.source);
      expect(component.newLead.status).toBe(mockLead.status);
      expect(component.newLead.value).toBe(mockLead.value);
      expect(component.newLead.notes).toBe(mockLead.notes);
    });

    it('opens the quick add panel when entering edit mode', () => {
      const fixture = TestBed.createComponent(LeadsComponent);
      const component = fixture.componentInstance;

      expect(component.showQuickAdd).toBe(false);

      component.editLead(mockLead);

      expect(component.showQuickAdd).toBe(true);
    });

    it('opens the detail modal when clicking a lead row in list view', () => {
      leadsServiceStub.getLeads.mockReturnValue(of([mockLead]));

      const fixture = TestBed.createComponent(LeadsComponent);
      fixture.detectChanges();

      const row = fixture.debugElement.query(By.css('tbody tr'));
      row.triggerEventHandler('click', {});
      fixture.detectChanges();

      expect(fixture.componentInstance.isEditingLead).toBe(false);
      expect(fixture.componentInstance.showQuickAdd).toBe(false);
      expect(fixture.nativeElement.textContent).toContain('Original posting');
    });

    it('opens the detail modal when clicking a kanban card', () => {
      leadsServiceStub.getLeads.mockReturnValue(
        of([{ ...mockLead, status: LeadStatus.CONTACTED }])
      );

      const fixture = TestBed.createComponent(LeadsComponent);
      fixture.componentInstance.viewMode = 'kanban';
      fixture.detectChanges();

      const card = fixture.debugElement.query(By.css('.kanban-card'));
      card.triggerEventHandler('click', {});
      fixture.detectChanges();

      expect(fixture.componentInstance.isEditingLead).toBe(false);
      expect(fixture.componentInstance.showQuickAdd).toBe(false);
      expect(fixture.nativeElement.textContent).toContain('Lead details');
    });

    it('calls updateLead when saving in edit mode', () => {
      leadsServiceStub.updateLead.mockReturnValue(of(mockLead));

      const fixture = TestBed.createComponent(LeadsComponent);
      const component = fixture.componentInstance;

      component.editLead(mockLead);
      component.saveLead();

      expect(leadsServiceStub.updateLead).toHaveBeenCalledWith(
        'lead-1',
        expect.objectContaining({
          name: mockLead.name,
          company: mockLead.company,
          email: mockLead.email,
        })
      );
    });

    it('submits all user-editable lead fields when updating a lead', () => {
      leadsServiceStub.updateLead.mockReturnValue(of(mockLead));

      const fixture = TestBed.createComponent(LeadsComponent);
      const component = fixture.componentInstance;

      component.editLead(mockLead);
      component.newLead.status = LeadStatus.QUALIFIED;
      component.newLead.nextFollowUp = '2026-04-15';
      component.newLead.assignedTo = 'owner-2';
      component.newLead.searchKeywords = ['react', 'frontend'];
      component.saveLead();

      expect(leadsServiceStub.updateLead).toHaveBeenCalledWith(
        'lead-1',
        expect.objectContaining({
          name: mockLead.name,
          company: mockLead.company,
          email: mockLead.email,
          phone: mockLead.phone,
          source: mockLead.source,
          status: LeadStatus.QUALIFIED,
          value: mockLead.value,
          notes: mockLead.notes,
          nextFollowUp: '2026-04-15',
          assignedTo: 'owner-2',
          searchKeywords: ['react', 'frontend'],
        })
      );
    });

    it('exits edit mode after successful save', () => {
      leadsServiceStub.updateLead.mockReturnValue(of(mockLead));

      const fixture = TestBed.createComponent(LeadsComponent);
      const component = fixture.componentInstance;

      component.editLead(mockLead);
      component.saveLead();
      fixture.detectChanges();

      expect(component.isEditingLead).toBe(false);
      expect(component.editingLeadId).toBeNull();
    });

    it('resets form when closing in edit mode', () => {
      const fixture = TestBed.createComponent(LeadsComponent);
      const component = fixture.componentInstance;

      component.editLead(mockLead);
      component.closeQuickAdd();

      expect(component.isEditingLead).toBe(false);
      expect(component.editingLeadId).toBeNull();
      expect(component.showQuickAdd).toBe(false);
      expect(component.newLead.name).toBe('');
    });
  });

  describe('search', () => {
    it('matches across keywords, notes, and contacts', () => {
      const fixture = TestBed.createComponent(LeadsComponent);
      const component = fixture.componentInstance;
      component.leads = [
        {
          ...mockLead,
          id: 'lead-a',
          searchKeywords: ['react modernization'],
          notes: 'Legacy frontend rescue',
          contacts: [
            {
              kind: 'email',
              value: 'owner@example.com',
              href: 'mailto:owner@example.com',
              label: 'Owner',
              source: 'provider',
              isPrimary: true,
            },
          ],
        } as any,
        {
          ...mockLead,
          id: 'lead-b',
          name: 'Different Lead',
          company: 'Other Co',
          searchKeywords: ['wordpress'],
        },
      ];

      component.searchQuery = 'legacy owner';
      component.filterLeads();

      expect(component.filteredLeads.map((lead) => lead.id)).toEqual(['lead-a']);
    });
  });
});

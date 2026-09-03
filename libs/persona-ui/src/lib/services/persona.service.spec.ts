import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PersonaService } from './persona.service';
import { API_BASE_URL, PersonaTelosDto } from '@optimistic-tanuki/ui-models';

describe('PersonaService', () => {
  let service: PersonaService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:3000';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PersonaService, { provide: API_BASE_URL, useValue: baseUrl }],
    });
    service = TestBed.inject(PersonaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getAllPersonas issues a GET to /persona and returns the personas', () => {
    const mockPersonas: PersonaTelosDto[] = [
      {
        id: '1',
        name: 'project management',
        description: '',
        goals: [],
        skills: [],
        interests: [],
        limitations: [],
        strengths: [],
        objectives: [],
        coreObjective: '',
        exampleResponses: [],
        promptTemplate: '',
      },
    ];

    let result: PersonaTelosDto[] | undefined;
    service.getAllPersonas().subscribe((personas) => (result = personas));

    const req = httpMock.expectOne(`${baseUrl}/persona`);
    expect(req.request.method).toBe('GET');
    req.flush(mockPersonas);

    expect(result).toEqual(mockPersonas);
  });

  it('getPersona issues a GET to /persona/:id and returns the persona', () => {
    const mockPersona: PersonaTelosDto = {
      id: '99',
      name: 'Marketing',
      description: '',
      goals: [],
      skills: [],
      interests: [],
      limitations: [],
      strengths: [],
      objectives: [],
      coreObjective: '',
      exampleResponses: [],
      promptTemplate: '',
    };

    let result: PersonaTelosDto | undefined;
    service.getPersona('99').subscribe((persona) => (result = persona));

    const req = httpMock.expectOne(`${baseUrl}/persona/99`);
    expect(req.request.method).toBe('GET');
    req.flush(mockPersona);

    expect(result).toEqual(mockPersona);
  });
});

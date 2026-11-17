import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { of } from 'rxjs';
import { BoundaryReviewPageComponent } from './boundary-review-page.component';

const id='11111111-1111-4111-8111-111111111111';
describe('BoundaryReviewPageComponent',()=>{
  beforeEach(async()=>{await TestBed.configureTestingModule({imports:[BoundaryReviewPageComponent,HttpClientTestingModule],providers:[{provide:ActivatedRoute,useValue:{paramMap:of(convertToParamMap({communityId:id}))}},{provide:API_BASE_URL,useValue:'/api'}]}).compileComponents();});
  it('explains an unverified candidate and shows its town context',()=>{
    const fixture=TestBed.createComponent(BoundaryReviewPageComponent);fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(`/api/directory/towns/${id}/boundary-candidate`).flush({candidate:{communityId:id,geoid:'1323872',layer:'place',vintage:'2026',stateFips:'13',archiveSha256:'a'.repeat(64),reviewContext:{name:'Douglas, GA',city:'Douglas',adminArea:'GA',countryCode:'US',localityType:'city'}}});
    fixture.detectChanges();const text=fixture.nativeElement.textContent;
    expect(text).toContain('Boundary candidate');expect(text).toContain('Douglas, GA');expect(text).toContain('1323872');expect(text.toLowerCase()).toContain('not verified');expect(text.toLowerCase()).not.toContain('approve boundary');
  });
  it('shows a pending state when no candidate exists',()=>{
    const fixture=TestBed.createComponent(BoundaryReviewPageComponent);fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(`/api/directory/towns/${id}/boundary-candidate`).flush({candidate:null});fixture.detectChanges();
    expect(fixture.nativeElement.textContent.toLowerCase()).toContain('no current candidate');
  });
  it('shows a service error instead of an empty result when the review service fails',()=>{
    const fixture=TestBed.createComponent(BoundaryReviewPageComponent);fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(`/api/directory/towns/${id}/boundary-candidate`).flush('',{status:503,statusText:'Unavailable'});fixture.detectChanges();
    const text=fixture.nativeElement.textContent.toLowerCase();expect(text).toContain('candidate unavailable');expect(text).not.toContain('no current candidate');
  });
  it('records a confirmed review against the candidate the reviewer inspected',()=>{
    const fixture=TestBed.createComponent(BoundaryReviewPageComponent);fixture.detectChanges();
    const http=TestBed.inject(HttpTestingController);
    const candidate={communityId:id,changeToken:id,geographyHash:'b'.repeat(64),geoid:'1323872',layer:'place',vintage:'2026',stateFips:'13',archiveSha256:'a'.repeat(64),reviewContext:{name:'Douglas, GA',city:'Douglas',adminArea:'GA',countryCode:'US',localityType:'city'}};
    http.expectOne(`/api/directory/towns/${id}/boundary-candidate`).flush({candidate});fixture.detectChanges();
    Object.defineProperty(globalThis.crypto,'randomUUID',{value:()=>id,configurable:true});
    const component:any=fixture.componentInstance;
    component.recordDecision(candidate,'https://www.census.gov/example',false);
    http.expectNone(`/api/directory/towns/${id}/boundary-decisions`);
    component.recordDecision(candidate,'https://www.census.gov/example',true);
    const req=http.expectOne(`/api/directory/towns/${id}/boundary-decisions`);
    expect(req.request.method).toBe('POST');expect(req.request.body.candidate.geographyHash).toBe(candidate.geographyHash);expect(req.request.body.decision).toBe('verified');
    req.flush({recorded:true});fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('Review recorded');
  });

});

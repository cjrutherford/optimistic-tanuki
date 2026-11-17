import {CommonModule} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {Component,DestroyRef,inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {API_BASE_URL} from '@optimistic-tanuki/ui-models';
import {CardComponent} from '@optimistic-tanuki/common-ui';
import {forkJoin} from 'rxjs';

type LinkRequest={listingId:string;requestId:string;businessCommunityId:string;ownerId:string};
type Queue={requests:LinkRequest[];nextCursor:string|null};
@Component({selector:'app-directory-link-review-page',standalone:true,imports:[CommonModule,RouterLink,CardComponent],template:`
<section aria-labelledby="directory-link-title">
 <a routerLink="/dashboard/community-ops">← Community operations</a>
 <h2 id="directory-link-title">Business page link reviews</h2>
 <p>Compare the directory listing and the business page with independent evidence. Approval makes the connection visible while both remain eligible and public.</p>
 <label><input #adultOpt type="checkbox" /> Include adult-oriented listings in comparisons</label>
 <p aria-live="polite">{{ message }}</p>
 @if (!loading && !requests.length && !message) { <p>No pending link requests for this town.</p> }
 @for (request of requests; track request.requestId) {
  <otui-card><div class="review-card">
   @if (selected?.requestId === request.requestId && preview; as details) {
    <h3>{{ details.listing.name }}</h3><p>Location type: {{ details.listing.category }}</p>
    <p>Business page: {{ details.page.name }} ({{ details.page.slug }})</p>
    <label>Evidence URL <input #evidence type="url" maxlength="2048" placeholder="https://…" /></label>
    <label><input #attested type="checkbox" /> I compared the listing, business page and evidence.</label>
    <button type="button" [disabled]="submitting" (click)="decide(request,'approve',evidence.value,attested.checked)">Approve link</button>
    <button type="button" [disabled]="submitting" (click)="decide(request,'reject',evidence.value,attested.checked)">Reject link</button>
   } @else { <button type="button" (click)="inspect(request,adultOpt.checked)">Compare listing and business page</button> }
  </div></otui-card>
 }
 @if (nextCursor) {<button type="button" [disabled]="loading" (click)="loadNext()">Show more requests</button>}
</section>`,styles:[`.review-card{display:grid;gap:.75rem;padding:1.25rem}label{display:block}input[type=url]{display:block;width:100%;max-width:42rem}button{width:max-content}`]})
export class DirectoryLinkReviewPageComponent {
 private readonly http=inject(HttpClient);private readonly route=inject(ActivatedRoute);private readonly api=inject(API_BASE_URL).replace(/\/$/,'');private readonly destroyRef=inject(DestroyRef);
 town='';requests:LinkRequest[]=[];nextCursor:string|null=null;loading=false;submitting=false;message='';selected?:LinkRequest;preview?:{listing:{name:string;category:string};page:{name:string;slug:string}};private generation=0;private inspectedAdult=false;
 constructor(){this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params=>{this.town=params.get('communityId') || '';this.refresh();});}
 refresh(){this.requests=[];this.nextCursor=null;this.selected=undefined;this.preview=undefined;this.message='';this.load();}
 loadNext(){if(this.nextCursor)this.load(this.nextCursor);}
 private load(cursor?:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(this.town)){this.message='This town is unavailable.';return;}
  const town=this.town,generation=++this.generation;this.loading=true;
  this.http.get<Queue>(`${this.api}/directory/towns/${town}/business-link-requests${cursor?'?cursor='+encodeURIComponent(cursor):''}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:result=>{if(generation!==this.generation)return;this.loading=false;this.requests=cursor?[...this.requests,...result.requests]:result.requests;this.nextCursor=result.nextCursor;},error:()=>{if(generation!==this.generation)return;this.loading=false;this.message='Requests are unavailable. Please try again.';}});
 }
 inspect(request:LinkRequest,adult=false){this.inspectedAdult=adult===true;this.selected=request;this.preview=undefined;this.message='Loading comparison…';const town=this.town,chosen=request.requestId;
  forkJoin({listing:this.http.get<{name:string;category:string}>(`${this.api}/directory/towns/${town}/local-evaluation-listings/${request.listingId}${this.inspectedAdult?'?adult=1':''}`),page:this.http.get<{name:string;slug:string}>(`${this.api}/social/community/${request.businessCommunityId}`)}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:preview=>{if(this.town!==town||this.selected?.requestId!==chosen)return;if(!preview.listing?.name||!preview.page?.name||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(preview.page.slug || '')){this.message='The listing or page is unavailable.';return;}this.preview=preview;this.message='';},error:()=>{if(this.town===town&&this.selected?.requestId===chosen)this.message='The listing or page is unavailable.';}});
 }
 decide(request:LinkRequest,decision:'approve'|'reject',evidenceUrl:string,attested:boolean){
  if(!attested||!evidenceUrl.trim()||!this.preview||this.selected?.requestId!==request.requestId||this.submitting){this.message='Compare both records, provide an evidence URL and confirm your review.';return;}
  const town=this.town;this.submitting=true;this.message='Recording review…';
  this.http.post(`${this.api}/directory/towns/${town}/local-evaluation-listings/${request.listingId}/business-link/reviews`,{requestId:request.requestId,businessCommunityId:request.businessCommunityId,ownerId:request.ownerId,decision,evidenceUrl:evidenceUrl.trim(),attested:true,adult:this.inspectedAdult}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:()=>{this.submitting=false;if(this.town===town)this.refresh();},error:()=>{this.submitting=false;if(this.town===town)this.message='Review could not be recorded. Verify the page and evidence, then try again.';}});
 }
}

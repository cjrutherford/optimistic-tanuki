import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlogPageComponent } from './blog-page.component';
import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { BlogComposeComponent } from '@optimistic-tanuki/blogging-ui';

// Remove MockBlogComposeComponent definition

describe('BlogPageComponent', () => {
  let component: BlogPageComponent;
  let fixture: ComponentFixture<BlogPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogPageComponent, BlogComposeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should handle post submission', () => {
    jest.spyOn(component, 'onPostSubmitted');
    const blogComposeComponent = fixture.debugElement.children[0].componentInstance as BlogComposeComponent;
    const postData = { title: 'Test Post', content: 'Test Content' };
    blogComposeComponent.postSubmitted.emit(postData);
    expect(component.onPostSubmitted).toHaveBeenCalledWith(postData);
  });
});

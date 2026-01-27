import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent, SelectComponent } from '@optimistic-tanuki/form-ui';
import { CreateThreadDto, TopicDto } from '../models';

@Component({
    selector: 'lib-create-thread',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CardComponent,
        ButtonComponent,
        TextInputComponent,
        SelectComponent
    ],
    templateUrl: './create-thread.component.html',
    styleUrls: ['./create-thread.component.scss']
})
export class CreateThreadComponent {
    @Input() topics: TopicDto[] = [];
    @Output() create = new EventEmitter<CreateThreadDto>();
    @Output() cancelThread = new EventEmitter<void>();

    title = '';
    description = '';
    selectedTopicId = '';
    visibility: 'public' | 'private' = 'public';

    onSubmit() {
        if (!this.title || !this.selectedTopicId) return;

        const newThread: CreateThreadDto = {
            title: this.title,
            description: this.description,
            topicId: this.selectedTopicId,
            visibility: this.visibility,
            // userId and profileId will be handled by the smart component / service
            userId: '',
            profileId: ''
        };
        this.create.emit(newThread);
    }

    onCancel() {
        this.cancelThread.emit();
    }
}

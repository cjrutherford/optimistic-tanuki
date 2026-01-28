import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent, SelectComponent } from '@optimistic-tanuki/form-ui';
import { CreateTopicDto } from '../models';

@Component({
    selector: 'lib-create-topic',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CardComponent,
        ButtonComponent,
        TextInputComponent,
        SelectComponent
    ],
    templateUrl: './create-topic.component.html',
    styleUrls: ['./create-topic.component.scss']
})
export class CreateTopicComponent {
    @Output() create = new EventEmitter<CreateTopicDto>();
    @Output() cancelTopic = new EventEmitter<void>();

    title = '';
    description = '';
    visibility: 'public' | 'private' = 'public';
    visabilityOptions: { label: string, value: 'public' | 'private' }[] = [
        { label: 'Public', value: 'public' },
        { label: 'Private', value: 'private' },
    ]

    onSubmit() {
        if (!this.title) return;

        const newTopic: CreateTopicDto = {
            title: this.title,
            description: this.description,
            visibility: this.visibility,
            // userId and profileId will be handled by the smart component / service
            userId: '',
            profileId: ''
        };
        this.create.emit(newTopic);
    }

    onCancel() {
        this.cancelTopic.emit();
    }
}

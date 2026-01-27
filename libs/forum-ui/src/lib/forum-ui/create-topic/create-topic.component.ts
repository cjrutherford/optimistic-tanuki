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

    name = '';
    description = '';
    visibility: 'public' | 'private' = 'public';

    onSubmit() {
        if (!this.name) return;

        const newTopic: CreateTopicDto = {
            name: this.name,
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

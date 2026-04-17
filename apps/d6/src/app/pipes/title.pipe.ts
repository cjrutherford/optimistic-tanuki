import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'title',
  standalone: true,
})
export class TitlePipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';
    const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
    return capitalized.replace(/([A-Z])/g, (match, p1, offset) =>
      offset === 0 ? p1 : ' ' + p1
    );
  }
}

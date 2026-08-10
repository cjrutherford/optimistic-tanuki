import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProjectDto } from './update-project.dto';

describe('UpdateProjectDto', () => {
  it('rejects owner and members because project access fields are not editable', async () => {
    const dto = plainToInstance(UpdateProjectDto, {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Updated project',
      owner: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      members: [],
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['owner', 'members'])
    );
  });
});

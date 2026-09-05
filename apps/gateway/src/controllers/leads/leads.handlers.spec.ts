import { of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  LeadApplicationCommands,
  LeadCommands,
  LeadFlagCommands,
  LeadOnboardingCommands,
  LeadTopicCommands,
} from '@optimistic-tanuki/constants';
import { UserContext } from '@optimistic-tanuki/models';
import { LeadsController, MAX_RESUME_UPLOAD_BYTES } from './leads.controller';

/**
 * The spec beside this one covers a handful of representative proxies. These
 * invoke the rest of the handlers: the exact payload each sends to the lead
 * service, the not-found branches, the shared context guard, and the export
 * path that writes straight to the Express response.
 */
describe('Gateway LeadsController handlers', () => {
  let controller: LeadsController;
  let leadClient: { send: jest.Mock };

  const user = {
    userId: 'user-1',
    profileId: 'profile-1',
  } as unknown as UserContext;
  const appScope = 'leads-app';
  const context = {
    userId: 'user-1',
    profileId: 'profile-1',
    appScope: 'leads-app',
  };

  const resolves = (value: unknown) =>
    leadClient.send.mockReturnValue(of(value));
  const rejectsWith = (error: unknown) =>
    leadClient.send.mockReturnValue(throwError(() => error));

  const lastPattern = () => leadClient.send.mock.calls.at(-1)?.[0];
  const lastPayload = () => leadClient.send.mock.calls.at(-1)?.[1];

  beforeEach(() => {
    leadClient = { send: jest.fn().mockReturnValue(of(null)) };
    controller = new LeadsController(leadClient as unknown as ClientProxy);
  });

  describe('context guard', () => {
    it('refuses every context-bound handler when the caller has no leads profile', async () => {
      const profileless = { userId: 'user-1' } as unknown as UserContext;

      await expect(
        controller.findAll(profileless, appScope)
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(controller.getStats(profileless, appScope)).rejects.toThrow(
        'An active leads profile is required.'
      );
      expect(leadClient.send).not.toHaveBeenCalled();
    });
  });

  describe('leads', () => {
    it('forwards undefined status/source filters when none are given', async () => {
      resolves([]);

      await controller.findAll(user, appScope);

      expect(lastPattern()).toEqual({ cmd: LeadCommands.FIND_ALL });
      expect(lastPayload()).toEqual({
        status: undefined,
        source: undefined,
        ...context,
      });
    });

    it('returns the stats payload from the service', async () => {
      resolves({ total: 3 });

      await expect(controller.getStats(user, appScope)).resolves.toEqual({
        total: 3,
      });
      expect(lastPattern()).toEqual({ cmd: LeadCommands.GET_STATS });
      expect(lastPayload()).toEqual(context);
    });

    it('returns a found lead', async () => {
      resolves({ id: 'lead-1' });

      await expect(
        controller.findOne(user, appScope, 'lead-1')
      ).resolves.toEqual({ id: 'lead-1' });
      expect(lastPattern()).toEqual({ cmd: LeadCommands.FIND_ONE });
      expect(lastPayload()).toEqual({ id: 'lead-1', ...context });
    });

    it('turns a missing lead into a 404', async () => {
      resolves(null);

      await expect(
        controller.findOne(user, appScope, 'lead-1')
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('patches a lead through the UPDATE command', async () => {
      resolves({ id: 'lead-1', status: 'won' });

      await expect(
        controller.patch(user, appScope, 'lead-1', { status: 'won' } as never)
      ).resolves.toEqual({ id: 'lead-1', status: 'won' });
      expect(lastPattern()).toEqual({ cmd: LeadCommands.UPDATE });
      expect(lastPayload()).toEqual({
        id: 'lead-1',
        dto: { status: 'won' },
        ...context,
      });
    });

    it('turns a missing lead into a 404 on patch', async () => {
      resolves(undefined);

      await expect(
        controller.patch(user, appScope, 'lead-1', {} as never)
      ).rejects.toThrow('Lead lead-1 not found');
    });

    it('puts a lead through the same UPDATE command', async () => {
      resolves({ id: 'lead-1' });

      await controller.update(user, appScope, 'lead-1', {
        name: 'Renamed',
      } as never);

      expect(lastPattern()).toEqual({ cmd: LeadCommands.UPDATE });
      expect(lastPayload()).toEqual({
        id: 'lead-1',
        dto: { name: 'Renamed' },
        ...context,
      });
    });

    it('turns a missing lead into a 404 on put', async () => {
      resolves(null);

      await expect(
        controller.update(user, appScope, 'lead-1', {} as never)
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes a lead and returns the service result verbatim', async () => {
      resolves({ deleted: true });

      await expect(
        controller.delete(user, appScope, 'lead-1')
      ).resolves.toEqual({ deleted: true });
      expect(lastPattern()).toEqual({ cmd: LeadCommands.DELETE });
      expect(lastPayload()).toEqual({ id: 'lead-1', ...context });
    });
  });

  describe('topics', () => {
    it('lists topics with only the scoped context as the payload', async () => {
      resolves([{ id: 'topic-1' }]);

      await expect(controller.findAllTopics(user, appScope)).resolves.toEqual([
        { id: 'topic-1' },
      ]);
      expect(lastPattern()).toEqual({ cmd: LeadTopicCommands.FIND_ALL });
      expect(lastPayload()).toEqual(context);
    });

    it('spreads the context into the update payload rather than nesting it', async () => {
      resolves({ id: 'topic-1' });

      await controller.updateTopic(user, appScope, 'topic-1', {
        name: 'Cloud',
      } as never);

      expect(lastPattern()).toEqual({ cmd: LeadTopicCommands.UPDATE });
      expect(lastPayload()).toEqual({
        id: 'topic-1',
        dto: { name: 'Cloud' },
        ...context,
      });
    });

    it('turns a missing topic into a 404 on update', async () => {
      resolves(null);

      await expect(
        controller.updateTopic(user, appScope, 'topic-1', {} as never)
      ).rejects.toThrow('Lead topic topic-1 not found');
    });

    it('deletes a topic', async () => {
      resolves({ deleted: true });

      await expect(
        controller.deleteTopic(user, appScope, 'topic-1')
      ).resolves.toEqual({ deleted: true });
      expect(lastPattern()).toEqual({ cmd: LeadTopicCommands.DELETE });
      expect(lastPayload()).toEqual({ id: 'topic-1', ...context });
    });

    it('runs discovery keyed by topicId', async () => {
      resolves({ topicId: 'topic-1', leadsFound: 2 });

      await expect(
        controller.runTopicDiscovery(user, appScope, 'topic-1')
      ).resolves.toEqual({ topicId: 'topic-1', leadsFound: 2 });
      expect(lastPattern()).toEqual({ cmd: LeadTopicCommands.RUN_DISCOVERY });
      expect(lastPayload()).toEqual({ topicId: 'topic-1', ...context });
    });

    it('turns a missing topic into a 404 when discovery returns nothing', async () => {
      resolves(null);

      await expect(
        controller.runTopicDiscovery(user, appScope, 'topic-1')
      ).rejects.toThrow('Lead topic topic-1 not found');
    });

    it('reads discovery status keyed by topicId', async () => {
      resolves({ topicId: 'topic-1', status: 'running' });

      await expect(
        controller.getTopicDiscoveryStatus(user, appScope, 'topic-1')
      ).resolves.toEqual({ topicId: 'topic-1', status: 'running' });
      expect(lastPattern()).toEqual({
        cmd: LeadTopicCommands.GET_DISCOVERY_STATUS,
      });
      expect(lastPayload()).toEqual({ topicId: 'topic-1', ...context });
    });

    it('turns a missing topic into a 404 when the status is empty', async () => {
      resolves(null);

      await expect(
        controller.getTopicDiscoveryStatus(user, appScope, 'topic-1')
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('flags', () => {
    it('nests the context under `context` when creating a flag', async () => {
      resolves({ id: 'flag-1' });

      await expect(
        controller.createFlag(user, appScope, 'lead-1', {
          reason: 'spam',
        } as never)
      ).resolves.toEqual({ id: 'flag-1' });
      expect(lastPattern()).toEqual({ cmd: LeadFlagCommands.CREATE });
      expect(lastPayload()).toEqual({
        leadId: 'lead-1',
        dto: { reason: 'spam' },
        context,
      });
    });
  });

  describe('onboarding', () => {
    it('forwards the raw profile body to ANALYZE with no context attached', async () => {
      resolves({ topics: [] });

      await expect(
        controller.analyzeOnboarding({ headline: 'dev' })
      ).resolves.toEqual({ topics: [] });
      expect(lastPattern()).toEqual({ cmd: LeadOnboardingCommands.ANALYZE });
      expect(lastPayload()).toEqual({ headline: 'dev' });
    });

    it('defaults the location autocomplete query to an empty string', async () => {
      resolves([]);

      await controller.autocompleteLocations();

      expect(lastPayload()).toEqual({ query: '' });
    });

    it('forwards the ATS company lookup body verbatim', async () => {
      resolves({ boardToken: 'acme' });

      await expect(
        controller.lookupAtsCompany({ companyName: 'Acme' })
      ).resolves.toEqual({ boardToken: 'acme' });
      expect(lastPattern()).toEqual({
        cmd: LeadOnboardingCommands.LOOKUP_ATS_COMPANY,
      });
      expect(lastPayload()).toEqual({ companyName: 'Acme' });
    });

    it('nests the context for ATS company suggestions', async () => {
      resolves(['Acme']);

      await expect(
        controller.suggestAtsCompanies(user, appScope)
      ).resolves.toEqual(['Acme']);
      expect(lastPattern()).toEqual({
        cmd: LeadOnboardingCommands.SUGGEST_ATS_COMPANIES,
      });
      expect(lastPayload()).toEqual({ context });
    });

    it('merges the DISC body with the nested context', async () => {
      resolves({ nextQuestion: 'q1' });

      await expect(
        controller.advanceDiscInterview(user, appScope, {
          answers: [],
        } as never)
      ).resolves.toEqual({ nextQuestion: 'q1' });
      expect(lastPattern()).toEqual({
        cmd: LeadOnboardingCommands.ADVANCE_DISC,
      });
      expect(lastPayload()).toEqual({ answers: [], context });
    });
  });

  describe('parseResume', () => {
    const file = (buffer: Buffer) => ({
      originalname: 'resume.pdf',
      mimetype: 'application/pdf',
      buffer,
    });

    it('base64-encodes the upload and returns the parsed result', async () => {
      resolves({ fullName: 'Ada' });

      await expect(
        controller.parseResume(file(Buffer.from('hello')))
      ).resolves.toEqual({ fullName: 'Ada' });
      expect(lastPattern()).toEqual({
        cmd: LeadOnboardingCommands.PARSE_RESUME,
      });
      expect(lastPayload()).toEqual({
        filename: 'resume.pdf',
        mimeType: 'application/pdf',
        contentBase64: Buffer.from('hello').toString('base64'),
      });
    });

    it('rejects a missing file with a 400 before calling the service', async () => {
      await expect(controller.parseResume(undefined as never)).rejects.toThrow(
        'Resume file is required.'
      );
      expect(leadClient.send).not.toHaveBeenCalled();
    });

    it('accepts an upload exactly at the size limit', async () => {
      resolves({ fullName: 'Ada' });

      await expect(
        controller.parseResume(file(Buffer.alloc(MAX_RESUME_UPLOAD_BYTES)))
      ).resolves.toEqual({ fullName: 'Ada' });
    });

    it('re-raises a downstream 400 refusal as a BadRequestException with its reason', async () => {
      rejectsWith({ statusCode: 400, message: 'That looks like a scan.' });

      await expect(
        controller.parseResume(file(Buffer.from('x')))
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          message: 'That looks like a scan.',
        }),
      });
      await expect(
        controller.parseResume(file(Buffer.from('x')))
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('falls back to a generic message when the 400 refusal carries none', async () => {
      rejectsWith({ statusCode: 400 });

      await expect(
        controller.parseResume(file(Buffer.from('x')))
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          message: 'That file could not be read.',
        }),
      });
    });

    it('rethrows any non-400 downstream failure untouched', async () => {
      const failure = new Error('parser crashed');
      rejectsWith(failure);

      await expect(controller.parseResume(file(Buffer.from('x')))).rejects.toBe(
        failure
      );
    });
  });

  describe('applications', () => {
    it('generates an application for a lead', async () => {
      resolves({ id: 'app-1' });

      await expect(
        controller.generateApplication(user, appScope, 'lead-1')
      ).resolves.toEqual({ id: 'app-1' });
      expect(lastPattern()).toEqual({ cmd: LeadApplicationCommands.GENERATE });
      expect(lastPayload()).toEqual({ leadId: 'lead-1', context });
    });

    it('fetches the latest application', async () => {
      resolves({ id: 'app-1' });

      await expect(
        controller.findApplication(user, appScope, 'lead-1')
      ).resolves.toEqual({ id: 'app-1' });
      expect(lastPattern()).toEqual({
        cmd: LeadApplicationCommands.FIND_LATEST,
      });
      expect(lastPayload()).toEqual({ leadId: 'lead-1', context });
    });

    it('fetches the full application history', async () => {
      resolves([{ id: 'app-1' }]);

      await expect(
        controller.findApplicationHistory(user, appScope, 'lead-1')
      ).resolves.toEqual([{ id: 'app-1' }]);
      expect(lastPattern()).toEqual({
        cmd: LeadApplicationCommands.FIND_HISTORY,
      });
      expect(lastPayload()).toEqual({ leadId: 'lead-1', context });
    });

    describe('export', () => {
      const makeResponse = () =>
        ({
          setHeader: jest.fn(),
          send: jest.fn(),
        } as unknown as Response & {
          setHeader: jest.Mock;
          send: jest.Mock;
        });

      it('streams the decoded document as an attachment', async () => {
        resolves({
          contentType: 'application/vnd.oasis.opendocument.text',
          filename: 'ada-resume.odt',
          contentBase64: Buffer.from('document bytes').toString('base64'),
        });
        const response = makeResponse();

        await controller.exportApplication(
          user,
          appScope,
          'lead-1',
          'resume',
          'odt',
          response
        );

        expect(lastPattern()).toEqual({ cmd: LeadApplicationCommands.EXPORT });
        expect(lastPayload()).toEqual({
          leadId: 'lead-1',
          kind: 'resume',
          format: 'odt',
          candidateName: 'user-1',
          context,
        });
        expect(response.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'application/vnd.oasis.opendocument.text'
        );
        expect(response.setHeader).toHaveBeenCalledWith(
          'Content-Disposition',
          'attachment; filename="ada-resume.odt"'
        );
        expect((response.send as jest.Mock).mock.calls[0][0]).toEqual(
          Buffer.from('document bytes')
        );
      });

      it('defaults kind to resume and format to docx', async () => {
        resolves({
          contentType: 'application/octet-stream',
          filename: 'f.docx',
          contentBase64: '',
        });

        await controller.exportApplication(
          user,
          appScope,
          'lead-1',
          undefined as never,
          undefined as never,
          makeResponse()
        );

        expect(lastPayload()).toMatchObject({
          kind: 'resume',
          format: 'docx',
        });
      });

      it('turns a missing export into a 404 without writing to the response', async () => {
        resolves(null);
        const response = makeResponse();

        await expect(
          controller.exportApplication(
            user,
            appScope,
            'lead-1',
            'resume',
            'docx',
            response
          )
        ).rejects.toThrow('No generated application exists for lead lead-1');
        expect(response.send).not.toHaveBeenCalled();
      });
    });
  });
});

import { OptomisitcTanukiAPIService } from './generated/chat';

/**
 * Guards against tag-filter regressions silently dropping operations from
 * the generated client: all six chat routes must stay present.
 * NOTE: lives outside src/generated/ because orval `clean:true` wipes that
 * directory on every run.
 */
describe('generated chat client operations', () => {
  it('exposes all six chat operations', () => {
    for (const method of [
      'chatControllerGetConversations',
      'chatControllerGetConversation',
      'chatControllerGetOrCreateDirectChat',
      'chatControllerCreateCommunityChat',
      'chatControllerGetMessages',
      'chatControllerSendMessage',
    ] as const) {
      expect(typeof OptomisitcTanukiAPIService.prototype[method]).toBe(
        'function'
      );
    }
  });
});

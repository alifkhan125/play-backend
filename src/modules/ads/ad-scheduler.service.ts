import { AdCampaignModel } from './ad-campaign.model.js';
import { logger } from '../../infrastructure/logger/logger.js';

export class AdSchedulerService {
  private isProcessing = false;

  /**
   * Periodically checks database to activate approved ads whose start time has arrived
   * and marks active ads as completed when their end time is reached.
   */
  async processScheduledAds(): Promise<{ activated: number; expired: number }> {
    if (this.isProcessing) {
      return { activated: 0, expired: 0 };
    }

    this.isProcessing = true;
    const now = new Date();
    let activatedCount = 0;
    let expiredCount = 0;

    try {
      // 1. Activate approved and paid ads whose startsAt has arrived
      const activatedResult = await AdCampaignModel.updateMany(
        {
          status: 'approved',
          paymentStatus: 'paid',
          startsAt: { $lte: now },
          $or: [
            { endsAt: { $exists: false } },
            { endsAt: { $gt: now } },
          ],
        },
        {
          $set: { status: 'active' },
        },
      ).exec();

      activatedCount = activatedResult.modifiedCount;
      if (activatedCount > 0) {
        logger.info({ activatedCount }, '[AdScheduler] Ad campaigns automatically activated');
      }

      // 2. Mark active ads as completed when endsAt has passed
      const expiredResult = await AdCampaignModel.updateMany(
        {
          status: 'active',
          endsAt: { $lte: now },
        },
        {
          $set: { status: 'completed' },
        },
      ).exec();

      expiredCount = expiredResult.modifiedCount;
      if (expiredCount > 0) {
        logger.info({ expiredCount }, '[AdScheduler] Ad campaigns automatically completed');
      }

      return { activated: activatedCount, expired: expiredCount };
    } catch (error) {
      logger.error({ err: error }, '[AdScheduler] Error executing scheduled ad lifecycle job');
      return { activated: 0, expired: 0 };
    } finally {
      this.isProcessing = false;
    }
  }
}

export const adSchedulerService = new AdSchedulerService();

import { CompanySettings } from '../companySettingsApi';
import {
  IPrinterDriver,
  PrintJob,
  PrintJobType,
  PrintOptions,
  PrintResult,
  UniversalPrinterConfig,
} from './PrinterTypes';

type QueueListener = (jobs: PrintJob[], currentJob: PrintJob | null) => void;

export class PrinterQueue {
  private queue: PrintJob[] = [];
  private history: PrintJob[] = [];
  private isProcessing: boolean = false;
  private currentJob: PrintJob | null = null;
  private listeners: Set<QueueListener> = new Set();
  private maxHistorySize: number = 20;
  private maxRetries: number = 1;

  // Window to prevent accidental double clicks / double prints (5 seconds)
  private recentOrderPrints: Map<string, number> = new Map();

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener([...this.queue], this.currentJob);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const queueCopy = [...this.queue];
    for (const listener of this.listeners) {
      try {
        listener(queueCopy, this.currentJob);
      } catch (err) {
        console.warn('[PrinterQueue] listener notification error:', err);
      }
    }
  }

  /**
   * Enqueue a new print job with duplicate-print protection.
   *
   * @param driver   The printer driver to use (resolved from the calling context's config).
   * @param type     Job type (RECEIPT, KOT, REPRINT, TEST, …)
   * @param order    Order data payload.
   * @param company  Company settings for receipt header.
   * @param options  Print options (copies, autoCut, isReprint, …).
   * @param config   The UniversalPrinterConfig for this context (POS or Kiosk).
   *                 Passed through to drivers so each context uses its own IP/USB/SUNMI settings.
   */
  public async enqueue(
    driver: IPrinterDriver,
    type: PrintJobType,
    order: any,
    company: CompanySettings,
    options: PrintOptions = {},
    config?: UniversalPrinterConfig
  ): Promise<PrintResult> {
    const orderNo = String(order?.OrderNo || order?.orderNo || order?.billNumber || order?.OrderNumber || order?.id || 'NO_ORDER');
    const dedupKey = `${type}_${orderNo}`;
    const now = Date.now();

    // Duplicate protection: prevent duplicate submit within 5 seconds unless reprint
    if (!options.isReprint && type !== 'TEST') {
      const lastPrintTime = this.recentOrderPrints.get(dedupKey);
      if (lastPrintTime && now - lastPrintTime < 5000) {
        console.warn(`[PrinterQueue] Blocked duplicate print job for order ${orderNo} within 5s.`);
        return {
          success: false,
          jobId: `DEDUP-${now}`,
          printerType: driver.type,
          printerName: '',
          orderNo,
          message: `Duplicate print request ignored for order ${orderNo}. Please wait or click Reprint.`,
        };
      }
      this.recentOrderPrints.set(dedupKey, now);
    }

    const job: PrintJob = {
      id: `JOB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      order,
      company,
      options,
      config,
      createdAt: now,
      retries: 0,
      status: 'PENDING',
    };

    return new Promise<PrintResult>((resolve) => {
      const executeJob = async (): Promise<void> => {
        job.status = 'PRINTING';
        this.currentJob = job;
        this.notify();

        let result: PrintResult;
        try {
          if (type === 'RECEIPT' || type === 'PAYMENT' || type === 'REPRINT') {
            result = await (driver as any).printReceipt(job.order, job.company, job.options, job.config);
          } else if (type === 'KOT') {
            result = await (driver as any).printKOT(job.order, job.company, job.options, job.config);
          } else if (type === 'TEST') {
            result = await (driver as any).testPrint(job.company, job.config);
          } else {
            result = await (driver as any).printReceipt(job.order, job.company, job.options, job.config);
          }

          if (result.success) {
            job.status = 'SUCCESS';
          } else {
            if (job.retries < this.maxRetries && !result.offlineReason?.includes('duplicate')) {
              job.retries++;
              console.warn(
                `[PrinterQueue] Job ${job.id} failed, retrying (${job.retries}/${this.maxRetries})...`
              );
              await new Promise((r) => setTimeout(r, 800));
              return executeJob();
            } else {
              job.status = 'FAILED';
              job.error = result.message;
            }
          }
        } catch (err: any) {
          job.status = 'FAILED';
          job.error = err?.message || 'Unhandled printing exception';
          result = {
            success: false,
            jobId: job.id,
            printerType: driver.type,
            printerName: '',
            orderNo,
            message: job.error || 'Printing failed',
          };
        }

        this.archiveJob(job);
        this.currentJob = null;
        this.notify();
        resolve(result);
      };

      this.queue.push({ ...job, _executor: executeJob } as any);
      this.notify();
      this.processNext();
    });
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const nextItem: any = this.queue.shift();

    if (nextItem && typeof nextItem._executor === 'function') {
      try {
        await nextItem._executor();
      } catch (err) {
        console.error('[PrinterQueue] Job processing error:', err);
      }
    }

    this.isProcessing = false;
    if (this.queue.length > 0) {
      this.processNext();
    }
  }

  private archiveJob(job: PrintJob) {
    this.history.unshift(job);
    if (this.history.length > this.maxHistorySize) {
      this.history.pop();
    }
  }

  public getQueue(): PrintJob[] {
    return [...this.queue];
  }

  public getHistory(): PrintJob[] {
    return [...this.history];
  }

  public getCurrentJob(): PrintJob | null {
    return this.currentJob ? { ...this.currentJob } : null;
  }

  public clearQueue() {
    this.queue = [];
    this.notify();
  }
}

export const printerQueue = new PrinterQueue();

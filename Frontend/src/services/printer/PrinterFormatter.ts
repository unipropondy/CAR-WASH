import { CompanySettings } from '../companySettingsApi';
import { PaperWidth, PrintOptions } from './PrinterTypes';
import { formatSgDate, formatSgTime, formatSgDateTime, getDbTime } from '../timeService';

// Standard ESC/POS Control Byte Constants
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export class EscPosBuilder {
  private buffer: number[] = [];

  constructor() {
    this.init();
  }

  public init(): EscPosBuilder {
    this.buffer.push(ESC, 0x40); // ESC @
    this.buffer.push(ESC, 0x52, 0x00); // ESC R 0: International Character Set USA (0x23 is '#')
    this.buffer.push(ESC, 0x74, 0x00); // ESC t 0: Code Page PC437
    return this;
  }

  public alignLeft(): EscPosBuilder {
    this.buffer.push(ESC, 0x61, 0x00);
    return this;
  }

  public alignCenter(): EscPosBuilder {
    this.buffer.push(ESC, 0x61, 0x01);
    return this;
  }

  public alignRight(): EscPosBuilder {
    this.buffer.push(ESC, 0x61, 0x02);
    return this;
  }

  public bold(enable: boolean = true): EscPosBuilder {
    this.buffer.push(ESC, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  public underline(enable: boolean = true): EscPosBuilder {
    this.buffer.push(ESC, 0x2d, enable ? 0x01 : 0x00);
    return this;
  }

  /**
   * Character size: normal (0x00), double-height (0x01), double-width (0x10), double-both (0x11), quad (0x22)
   */
  public setTextSize(widthMul: number = 1, heightMul: number = 1): EscPosBuilder {
    const w = Math.max(1, Math.min(8, widthMul)) - 1;
    const h = Math.max(1, Math.min(8, heightMul)) - 1;
    const sizeByte = (w << 4) | h;
    this.buffer.push(GS, 0x21, sizeByte);
    return this;
  }

  public resetTextSize(): EscPosBuilder {
    this.buffer.push(GS, 0x21, 0x00);
    return this;
  }

  public text(str: string): EscPosBuilder {
    if (!str) return this;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 128) {
        this.buffer.push(code);
      } else if (
        code === 0x202f ||
        code === 0x00a0 ||
        (code >= 0x2000 && code <= 0x200b) ||
        code === 0x2028 ||
        code === 0x2029 ||
        code === 0x205f ||
        code === 0x3000 ||
        code === 0xfeff
      ) {
        // Unicode whitespace (narrow no-break space, NBSP, etc.) -> ASCII space
        this.buffer.push(0x20);
      } else if (str[i] === '•') {
        this.buffer.push(0x2d); // -
      } else if (str[i] === '✓') {
        this.buffer.push(0x76); // v
      } else if (str[i] === '—' || str[i] === '–') {
        this.buffer.push(0x2d); // -
      } else if (str[i] === '“' || str[i] === '”') {
        this.buffer.push(0x22); // "
      } else if (str[i] === '‘' || str[i] === '’') {
        this.buffer.push(0x27); // '
      } else {
        this.buffer.push(0x3f); // '?'
      }
    }
    return this;
  }

  public textLine(str: string = ''): EscPosBuilder {
    this.text(str);
    this.buffer.push(LF);
    return this;
  }

  public lineFeed(count: number = 1): EscPosBuilder {
    for (let i = 0; i < count; i++) {
      this.buffer.push(LF);
    }
    return this;
  }

  public cut(partial: boolean = true): EscPosBuilder {
    // GS V 66 0: Feed to cutter and cut without extra blank lines
    this.buffer.push(GS, 0x56, partial ? 0x42 : 0x41, 0x00);
    return this;
  }

  public openDrawer(): EscPosBuilder {
    // ESC p 0 25 250: pulse to cash drawer pin 2
    this.buffer.push(ESC, 0x70, 0x00, 0x19, 0xfa);
    return this;
  }

  /**
   * ESC/POS Native QR Code (Model 2)
   */
  public qrCode(content: string, moduleSize: number = 5): EscPosBuilder {
    if (!content) return this;
    const dataLen = content.length + 3;
    const pL = dataLen & 0xff;
    const pH = (dataLen >> 8) & 0xff;

    // 1. Set QR Code Model (Model 2)
    this.buffer.push(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // 2. Set Module Size (Dot size 3-8)
    const mSize = Math.max(2, Math.min(8, moduleSize));
    this.buffer.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, mSize);
    // 3. Set Error Correction Level (Level M = 49)
    this.buffer.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    // 4. Store QR Code Data
    this.buffer.push(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < content.length; i++) {
      this.buffer.push(content.charCodeAt(i));
    }
    // 5. Print QR Code
    this.buffer.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }

  /**
   * ESC/POS Code 128 Barcode
   */
  public barcode128(content: string, height: number = 60): EscPosBuilder {
    if (!content) return this;
    const clean = content.replace(/[^0-9A-Za-z-]/g, '').slice(0, 20);
    if (!clean) return this;

    // Set height
    this.buffer.push(GS, 0x68, Math.max(30, Math.min(100, height)));
    // Set width
    this.buffer.push(GS, 0x77, 0x02);
    // Text below barcode
    this.buffer.push(GS, 0x48, 0x02);
    // Print Code 128: GS k 73 len data
    this.buffer.push(GS, 0x6b, 0x49, clean.length);
    for (let i = 0; i < clean.length; i++) {
      this.buffer.push(clean.charCodeAt(i));
    }
    return this;
  }

  public toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  public toBase64(): string {
    const uint8 = this.toUint8Array();
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    if (typeof btoa !== 'undefined') {
      return btoa(binary);
    }
    // Node.js fallback
    return Buffer.from(uint8).toString('base64');
  }
}

/**
 * Common Layout Formatter for 58mm (32 chars) and 80mm (48 chars)
 */
export class PrinterFormatter {
  public static getLineWidth(paperWidth: PaperWidth): number {
    return paperWidth === '58mm' ? 32 : 48;
  }

  public static formatTwoCol(left: string, right: string, width: number): string {
    const l = left.trim();
    const r = right.trim();
    const spaceCount = width - l.length - r.length;
    if (spaceCount <= 0) {
      // If exceeds, truncate left slightly or split
      const avail = width - r.length - 1;
      return (avail > 0 ? l.slice(0, avail) : l) + ' ' + r;
    }
    return l + ' '.repeat(spaceCount) + r;
  }

  public static formatDivider(char: string = '-', width: number): string {
    return char.repeat(width);
  }

  /**
   * Build Full Customer Bill Receipt
   */
  public static buildReceipt(
    order: any,
    company: CompanySettings,
    paperWidth: PaperWidth = '80mm',
    options?: PrintOptions
  ): Uint8Array {
    const width = this.getLineWidth(paperWidth);
    const builder = new EscPosBuilder();

    const companyName = (company?.CompanyName || 'CAR WASH').trim();
    const address = (company?.Address || '').replace(/\r?\n/g, ' ').trim();
    const phone = company?.Phone ? `Tel: ${company.Phone}` : '';
    const email = company?.Email ? `Email: ${company.Email}` : '';
    const gstNo = company?.GSTNo ? `GST Reg: ${company.GSTNo}` : '';
    const gstRate = Number(company?.GSTPercentage ?? 0);
    const currency = company?.CurrencySymbol || '$';

    const orderNo = String(order?.billNumber || order?.orderNo || order?.OrderNo || order?.orderNumber || (order?.orderId ? `RB-${order.orderId}` : (order?.id ? `RB-${order.id}` : 'RECEIPT')));
    const custName = (order?.customerDetails?.customerName || order?.customerName || order?.CustomerName || 'Walk-in Customer').toString();
    const vehicleNo = (order?.customerDetails?.vehicleNumber || order?.vehicleNumber || order?.VehicleNumber || order?.vehiclePlate || 'WALK-IN').toString();
    const mobileNo = (order?.customerDetails?.mobileNumber || order?.mobileNumber || order?.MobileNumber || '').toString();
    const bayName = (order?.bayName || order?.BayName || (order?.bayId || order?.BayId ? `Bay ${order.bayId || order.BayId}` : 'Wash Bay')).toString();
    const packageName = (order?.selectedPackage?.name || order?.packageName || order?.PackageName || 'Express Foam Wash').toString();
    
    // Parse À La Carte services string e.g. "Vomit & Odour Removal ($80.00), Interior Wipe-Down ($10.00)"
    const rawAdditionalStr = String(order?.additionalServices || order?.AdditionalServices || '').trim();
    const parsedAddons: { name: string; price: number }[] = rawAdditionalStr
      ? rawAdditionalStr.split(/,\s*/).filter(Boolean).map((entry) => {
          const m = entry.match(/^(.*?)\s*\(\$([0-9.]+)\)$/);
          return {
            name: m ? m[1].trim() : entry.trim(),
            price: m ? Number(m[2]) : 0,
          };
        })
      : [];
    const parsedAddonsTotal = parsedAddons.reduce((sum, a) => sum + (Number.isFinite(a.price) ? a.price : 0), 0);
    const additionalAmt = Number(order?.additionalAmount ?? order?.AdditionalAmount ?? parsedAddonsTotal) || 0;

    // All prices are strictly GST Exclusive
    const rawPkgPrice = order?.packagePrice ?? order?.PackagePrice;
    const pkgPrice = rawPkgPrice != null ? Number(rawPkgPrice) : Math.max(0, Number(order?.totalAmount ?? order?.TotalAmount ?? 0) - Number(order?.gstAmount ?? order?.GSTAmount ?? 0) - additionalAmt);
    const base = Number((pkgPrice + additionalAmt).toFixed(2));
    const gst = Number(order?.gstAmount ?? order?.GSTAmount ?? ((base * gstRate) / 100));
    const total = Math.max(Number(order?.totalAmount ?? order?.TotalAmount ?? (base + gst)), Number((base + gst).toFixed(2)));
    const payMode = String(order?.paymentMode || order?.payMode || order?.PayMode || 'CASH').toUpperCase();
    const isDealerOrder = order?.userType === 'DEALER' || Boolean(order?.selectedDealer || order?.dealerId || order?.DealerId);
    const rawPayStatus = String(order?.paymentStatus || order?.PaymentStatus || '').toUpperCase();
    const isPendingStatus = payMode === 'CASH' || payMode === 'CREDIT' || isDealerOrder || rawPayStatus === 'PENDING';
    const isReprint = Boolean(options?.isReprint);

    const rawDate = order?.createdDate || order?.createdAt || order?.CreatedDate;
    let dateStr = formatSgDate(rawDate || getDbTime());
    let timeStr = formatSgTime(rawDate || getDbTime(), { hour: '2-digit', minute: '2-digit', hour12: true });

    // 1. REPRINT WATERMARK (If applicable)
    if (isReprint) {
      builder
        .alignCenter()
        .bold(true)
        .setTextSize(1, 1)
        .textLine('*** OFFICIAL REPRINT ***')
        .resetTextSize()
        .bold(false);
    }

    // 2. DYNAMIC COMPANY HEADER
    builder
      .alignCenter()
      .bold(true)
      .setTextSize(2, 2)
      .textLine(companyName)
      .resetTextSize()
      .bold(false);

    if (address) {
      builder.textLine(address);
    }

    const contactParts = [phone, gstNo].filter(Boolean);
    if (contactParts.length > 0) {
      builder.textLine(contactParts.join(' | '));
    }
    if (email) {
      builder.textLine(email);
    }

    // Double Divider
    builder.textLine(this.formatDivider('=', width));

    // 3. QUEUE NUMBER / TICKET BOX (Show last 4 digits only, e.g. 0009)
    const queueNo = (() => {
      const match = orderNo.match(/\d+$/);
      if (match && match[0]) {
        return match[0].slice(-4).padStart(4, '0');
      }
      const raw = orderNo.replace(/\D/g, '');
      return raw.length >= 4 ? raw.slice(-4) : (orderNo.length > 4 ? orderNo.slice(-4) : orderNo);
    })();

    builder
      .alignCenter()
      .bold(true)
      .textLine('OFFICIAL QUEUE TICKET')
      .setTextSize(2, 2)
      .textLine(`#${queueNo}`)
      .resetTextSize()
      .bold(false);

    builder.textLine(this.formatDivider('=', width));

    // 4. ORDER META
    builder.alignLeft();
    builder.textLine(this.formatTwoCol(`Date: ${dateStr}`, `Time: ${timeStr}`, width));
    builder.textLine(this.formatTwoCol(`Customer: ${custName.slice(0, 16)}`, `Veh: ${vehicleNo}`, width));
    if (mobileNo) {
      builder.textLine(`Mobile:   ${mobileNo}`);
    }
    if (order?.cashierName || company?.CashierName || options?.cashierName) {
      builder.textLine(`Cashier:  ${options?.cashierName || order?.cashierName || company?.CashierName}`);
    }

    builder.textLine(this.formatDivider('-', width));

    // 5. SERVICES & PACKAGES
    builder.bold(true);
    builder.textLine(this.formatTwoCol('SERVICE DESCRIPTION', `AMOUNT (${currency})`, width));
    builder.bold(false);
    builder.textLine(this.formatDivider('-', width));

    // Primary package - Base Price
    builder.bold(true).textLine(packageName).bold(false);
    builder.textLine(this.formatTwoCol(`  1x Bay Service (${bayName})`, `${currency}${pkgPrice.toFixed(2)}`, width));

    // À La Carte add-ons from order.additionalServices
    if (parsedAddons.length > 0) {
      builder.bold(true).textLine('A La Carte Upgrades:').bold(false);
      for (const addon of parsedAddons) {
        const lineName = `  + ${addon.name}`.slice(0, width - 10);
        builder.textLine(this.formatTwoCol(lineName, `${currency}${addon.price.toFixed(2)}`, width));
      }
    } else if (Array.isArray(order?.items) && order.items.length > 0) {
      for (const item of order.items) {
        if (item.name && item.name !== packageName) {
          const itemAmt = Number(item.amount || item.price || 0).toFixed(2);
          builder.textLine(this.formatTwoCol(`  + ${item.name}`, `${currency}${itemAmt}`, width));
        }
      }
    }

    builder.textLine(this.formatDivider('-', width));

    // 6. TOTALS & TAX BREAKDOWN - Base Amount, GST Amount, and Final Payable Amount
    builder.textLine(this.formatTwoCol('Base Amount:', `${currency}${base.toFixed(2)}`, width));
    if (gstRate > 0 || gst > 0) {
      builder.textLine(this.formatTwoCol(`GST (${gstRate}%):`, `${currency}${gst.toFixed(2)}`, width));
    }

    builder.textLine(this.formatDivider('-', width));

    // TOTAL AMOUNT IN BOLD ONLY (Standard size, clean alignment)
    builder
      .bold(true)
      .textLine(this.formatTwoCol('TOTAL PAID:', `${currency}${total.toFixed(2)}`, width))
      .bold(false);

    builder.textLine(this.formatDivider('-', width));

    // Payment details
    builder.textLine(this.formatTwoCol('Payment Mode:', payMode, width));
    builder.textLine(this.formatTwoCol('Payment Status:', isPendingStatus ? 'PENDING' : 'PAID (COMPLETED)', width));

    builder.textLine(this.formatDivider('=', width));

    // 7. DYNAMIC FOOTER (No extra empty lines, single line notice, bold brand signature)
    builder.alignCenter();
    builder.bold(true).textLine('THANK YOU FOR CHOOSING US!').bold(false);
    builder.textLine('Please retain receipt for vehicle collection.');
    builder.bold(true).textLine('CAR WASH-POS BY UNIPROSG').bold(false);

    if (options?.autoCut ?? true) {
      builder.cut(true);
    } else {
      builder.lineFeed(1);
    }

    if (options?.openDrawer) {
      builder.openDrawer();
    }

    return builder.toUint8Array();
  }

  public static buildOrderReceipt(
    order: any,
    company: CompanySettings,
    paperWidth: PaperWidth = '80mm',
    options?: PrintOptions
  ): Uint8Array {
    return this.buildReceipt(order, company, paperWidth, options);
  }

  /**
   * Build Kitchen / Bay Order Ticket (KOT)
   */
  public static buildKOT(
    order: any,
    company: CompanySettings,
    paperWidth: PaperWidth = '80mm',
    options?: PrintOptions
  ): Uint8Array {
    const width = this.getLineWidth(paperWidth);
    const builder = new EscPosBuilder();

    const companyName = (company?.CompanyName || 'CAR WASH').trim();
    const orderNo = order?.billNumber || order?.orderNo || `RB-${order?.orderId || '0001'}`;
    const vehicleNo = order?.customerDetails?.vehicleNumber || order?.vehicleNumber || 'WALK-IN';
    const vehicleModel = order?.customerDetails?.vehicleModel || order?.vehicleTypeName || 'Standard Vehicle';
    const bayName = order?.bayName || (order?.bayId ? `Bay ${order.bayId}` : 'Wash Bay 1');
    const packageName = order?.selectedPackage?.name || order?.packageName || 'Express Foam Wash';
    const isReprint = Boolean(options?.isReprint);
    const timeStr = formatSgTime(order?.createdDate || order?.createdAt || getDbTime(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    builder.alignCenter();
    if (isReprint) {
      builder.bold(true).textLine('*** DUPLICATE KOT ***').bold(false);
    }

    builder
      .bold(true)
      .setTextSize(2, 2)
      .textLine('BAY SERVICE KOT')
      .setTextSize(1, 1)
      .textLine(companyName)
      .resetTextSize()
      .bold(false);

    builder.textLine(this.formatDivider('=', width));

    // Big Bay & Vehicle Callout
    builder
      .alignCenter()
      .bold(true)
      .setTextSize(2, 2)
      .textLine(bayName.toUpperCase())
      .setTextSize(2, 1)
      .textLine(`PLATE: ${vehicleNo}`)
      .resetTextSize()
      .bold(false);

    builder.textLine(this.formatDivider('=', width));

    builder.alignLeft();
    builder.textLine(this.formatTwoCol(`Order: #${orderNo}`, `Time: ${timeStr}`, width));
    builder.textLine(`Vehicle: ${vehicleModel}`);
    if (order?.customerDetails?.customerName || order?.customerName) {
      builder.textLine(`Customer: ${order?.customerDetails?.customerName || order?.customerName}`);
    }

    builder.textLine(this.formatDivider('-', width));

    // Service Requirements
    builder.bold(true);
    builder.setTextSize(1, 2);
    builder.textLine(`SERVICE: ${packageName.toUpperCase()}`);
    builder.resetTextSize();
    builder.bold(false);

    if (Array.isArray(order?.items) && order.items.length > 0) {
      builder.textLine('Additional Detailing Items:');
      for (const item of order.items) {
        builder.textLine(`  [ ] ${item.name || item.packageName}`);
      }
    }

    if (order?.notes || order?.specialInstructions) {
      builder.textLine(this.formatDivider('-', width));
      builder.bold(true).textLine('SPECIAL INSTRUCTIONS:').bold(false);
      builder.textLine(order?.notes || order?.specialInstructions);
    }

    builder.textLine(this.formatDivider('=', width));
    builder.alignCenter();
    builder.barcode128(orderNo, 45);
    builder.lineFeed(1);
    builder.textLine(`KOT Generated: ${timeStr}`);

    if (options?.autoCut ?? true) {
      builder.cut(true);
    } else {
      builder.lineFeed(3);
    }

    return builder.toUint8Array();
  }

  public static buildKOTReceipt(
    order: any,
    company: CompanySettings,
    paperWidth: PaperWidth = '80mm',
    options?: PrintOptions
  ): Uint8Array {
    return this.buildKOT(order, company, paperWidth, options);
  }

  /**
   * Diagnostic Test Print Page
   */
  public static buildTestPrint(
    printerType: string,
    printerName: string,
    company: CompanySettings,
    paperWidth: PaperWidth = '80mm'
  ): Uint8Array {
    const width = this.getLineWidth(paperWidth);
    const builder = new EscPosBuilder();

    const companyName = (company?.CompanyName || 'CAR WASH').trim();
    const address = (company?.Address || '').replace(/\r?\n/g, ' ').trim();
    const dateStr = formatSgDateTime(getDbTime());

    builder
      .alignCenter()
      .bold(true)
      .setTextSize(2, 2)
      .textLine(companyName)
      .resetTextSize()
      .textLine(address)
      .textLine(this.formatDivider('=', width))
      .bold(true)
      .setTextSize(1, 2)
      .textLine('UNIVERSAL PRINTER TEST')
      .resetTextSize()
      .bold(false);

    builder.textLine(this.formatDivider('=', width));

    builder.alignLeft();
    builder.textLine(this.formatTwoCol('Printer Type:', printerType.toUpperCase(), width));
    builder.textLine(this.formatTwoCol('Device Name:', printerName.slice(0, 20), width));
    builder.textLine(this.formatTwoCol('Paper Width:', `${paperWidth} (${width} cols)`, width));
    builder.textLine(this.formatTwoCol('Status:', 'ONLINE & READY', width));
    builder.textLine(`Timestamp:   ${dateStr}`);

    builder.textLine(this.formatDivider('-', width));

    builder.bold(true).textLine('CHARACTER WIDTH TEST:').bold(false);
    builder.textLine('12345678901234567890123456789012'.slice(0, width));
    if (width > 32) {
      builder.textLine('123456789012345678901234567890123456789012345678'.slice(0, width));
    }

    builder.textLine(this.formatDivider('-', width));

    builder.bold(true).textLine('TEXT STYLING VERIFICATION:').bold(false);
    builder.alignLeft().textLine('Left Aligned Text');
    builder.alignCenter().textLine('Centered Aligned Text');
    builder.alignRight().textLine('Right Aligned Text');
    builder.alignLeft().bold(true).textLine('Bold Text Test').bold(false);
    builder.underline(true).textLine('Underlined Text Test').underline(false);

    builder.textLine(this.formatDivider('-', width));

    builder.alignCenter();
    builder.textLine('ESC/POS QR Code Test:');
    builder.qrCode('https://redbaycarwash.com', paperWidth === '58mm' ? 4 : 5);
    builder.lineFeed(1);

    builder.textLine('ESC/POS Barcode 128 Test:');
    builder.barcode128('TEST-12345', 40);

    builder.lineFeed(1);
    builder.textLine(this.formatDivider('=', width));
    builder.bold(true).textLine('TEST PRINT COMPLETED SUCCESSFULLY').bold(false);
    builder.textLine('Auto-cut paper test below:');

    builder.cut(true);
    return builder.toUint8Array();
  }
}

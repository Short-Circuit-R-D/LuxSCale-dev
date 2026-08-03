import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import 'svg2pdf.js';
import autoTable from 'jspdf-autotable';
import { CalculationResponse, CalculationResult } from './calculation-result.service';
import { FixtureResult } from './result-store.service';
import {
  parseIesFile,
  getBeamAngle,
  getFieldAngle,
  mirrorCandelaForSymmetry,
} from './ies-parser';

const PRIMARY = [235, 27, 38] as const;
const GRAY = [120, 120, 120] as const;
const LIGHT_GRAY = [200, 200, 200] as const;
const WHITE = [255, 255, 255] as const;
const BLACK = [0, 0, 0] as const;

function sanitize(str: string): string {
  if (!str) return str;
  return str
    .replace(/\u00B0/g, ' deg')
    .replace(/\u00B2/g, '2')
    .replace(/\u00B3/g, '3')
    .replace(/\u00D7/g, 'x')
    .replace(/\u00F7/g, '/')
    .replace(/\u00E9/g, 'e')
    .replace(/\u00E8/g, 'e')
    .replace(/\u00EA/g, 'e')
    .replace(/\u00EB/g, 'e')
    .replace(/\u00E0/g, 'a')
    .replace(/\u00E1/g, 'a')
    .replace(/\u00E2/g, 'a')
    .replace(/\u00E3/g, 'a')
    .replace(/\u00E4/g, 'a')
    .replace(/\u00C0/g, 'A')
    .replace(/\u00C1/g, 'A')
    .replace(/\u00C2/g, 'A')
    .replace(/\u00C3/g, 'A')
    .replace(/\u00C4/g, 'A')
    .replace(/\u00C9/g, 'E')
    .replace(/\u00C8/g, 'E')
    .replace(/\u00CA/g, 'E')
    .replace(/\u00CB/g, 'E')
    .replace(/\u00CD/g, 'I')
    .replace(/\u00CC/g, 'I')
    .replace(/\u00CE/g, 'I')
    .replace(/\u00CF/g, 'I')
    .replace(/\u00D3/g, 'O')
    .replace(/\u00D2/g, 'O')
    .replace(/\u00D4/g, 'O')
    .replace(/\u00D5/g, 'O')
    .replace(/\u00D6/g, 'O')
    .replace(/\u00DA/g, 'U')
    .replace(/\u00D9/g, 'U')
    .replace(/\u00DB/g, 'U')
    .replace(/\u00DC/g, 'U')
    .replace(/\u00F1/g, 'n')
    .replace(/\u00D1/g, 'N')
    .replace(/\u00E7/g, 'c')
    .replace(/\u00C7/g, 'C')
    .replace(/\u00DF/g, 'ss')
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00AE/g, '(R)')
    .replace(/\u2122/g, '(TM)')
    .replace(/\u00A9/g, '(C)')
    .replace(/\u03C1/g, 'p')
    .replace(/\u2248/g, '~')
    .replace(/\u2032/g, "'")
    .replace(/\u2033/g, '"')
    .replace(/[^\x00-\x7F]/g, '');
}

@Injectable({ providedIn: 'root' })
export class PdfReportService {
  // ─── Full Report ───────────────────────────────────────────────────

  async generateFullReport(
    response: CalculationResponse,
    fixtureResults: FixtureResult[],
  ): Promise<void> {
    const doc = new jsPDF('p', 'mm', 'a4');
    const w = doc.internal.pageSize.getWidth();
    let y = this.addTitleBanner(doc, w, 'LuxScale Lighting Report',
      response.project_info.project_name,
      `${response.project_info.company} — ${response.project_info.standard_task_or_activity}`);

    y = this.addProjectInfo(doc, y, response);
    y = this.addRoomDimensions(doc, y, response);
    y = this.addStandard(doc, y, response);
    y = this.addCalculationMeta(doc, y, response);

    // Summary
    y += 4;
    y = this.sectionHeader(doc, 'Summary', y);
    const compliantCount = response.results.filter((r) => r.is_compliant).length;
    y = this.table(doc, y, [
      ['Total Solutions', `${response.results.length}`],
      ['Compliant', `${compliantCount}`],
      ['Room Area', `${(response.width * response.length).toFixed(1)} m²`],
      ['Standard', response.standard_row.ref_no],
    ]);

    // Solutions
    doc.addPage();
    y = 20;
    y = this.sectionHeader(doc, 'Solutions', y);

    for (let i = 0; i < response.results.length; i++) {
      const result = response.results[i];
      const fixtureResult = fixtureResults.find(
        (fr) => fr.key.luminaire === result['Luminaire'] && fr.key.power === result['Power (W)'],
      );
      const fixture = fixtureResult?.fixtures[0] ?? null;

      if (i > 0) { doc.addPage(); y = 20; }

      y = this.addSolutionHeader(doc, w, y, i + 1, result);
      if (fixture) { y = await this.addFixtureDetails(doc, y, fixture); }
      y = this.addCalculations(doc, y, result);
    }

    doc.save('LuxScale_Full_Report.pdf');
  }

  // ─── Solution Report ───────────────────────────────────────────────

  async generateSolutionReport(
    response: CalculationResponse,
    result: CalculationResult,
    fixtureResult: FixtureResult | null,
    selectedCAngleIndex: number = 0,
  ): Promise<void> {
    const doc = new jsPDF('p', 'mm', 'a4');
    const w = doc.internal.pageSize.getWidth();
    const fixture = fixtureResult?.fixtures[0] ?? null;
    const luminaireName = result['Luminaire'] as string;

    let y = this.addTitleBanner(doc, w, 'LuxScale Solution Report',
      luminaireName,
      `${response.project_info.project_name} — ${response.project_info.company}`);

    y = this.addProjectInfo(doc, y, response);
    y = this.addRoomDimensions(doc, y, response);
    y = this.addStandard(doc, y, response);

    if (fixture) { y = await this.addFixtureDetails(doc, y, fixture); }
    y = this.addCalculations(doc, y, result);

    // IES Analysis
    if (fixture?.ies_file) {
      doc.addPage();
      y = 20;
      y = this.sectionHeader(doc, 'IES Photometric Analysis', y);

      try {
        const iesData = parseIesFile(fixture.ies_file);
        const mirrored = mirrorCandelaForSymmetry(
          iesData.candelaValues, iesData.horizontalAngles, iesData.symmetry);

        // Symmetry
        y = this.subHeader(doc, 'Symmetry', y);
        y = this.table(doc, y, [
          ['Type', iesData.symmetry.label],
          ['Description', iesData.symmetry.description],
          ['Assumed', iesData.symmetry.isAssumed ? 'Yes' : 'No'],
        ]);

        // C-plane data
        const cIdx = Math.min(selectedCAngleIndex, mirrored.candelaValues.length - 1);
        const cData = mirrored.candelaValues[cIdx];
        const cAngle = mirrored.horizontalAngles[cIdx];
        const peak = Math.max(...cData);
        const peakIdx = cData.indexOf(peak);
        const peakAngle = iesData.verticalAngles[peakIdx] ?? 0;
        const beam = getBeamAngle(cData, iesData.verticalAngles);
        const field = getFieldAngle(cData, iesData.verticalAngles);

        y += 4;
        y = this.subHeader(doc, `C-Plane Metrics — C${cAngle}°`, y);
        const mRows: string[][] = [
          ['Peak Candela', `${peak.toFixed(0)} cd @ ${peakAngle.toFixed(1)}°`],
        ];
        if (beam) {
          mRows.push(['Beam Angle (50%)', `${beam.beamAngle.toFixed(1)}°`]);
          mRows.push(['  Left', `${beam.leftAngle.toFixed(1)}°`]);
          mRows.push(['  Right', `${beam.rightAngle.toFixed(1)}°`]);
        }
        if (field) {
          mRows.push(['Field Angle (10%)', `${field.fieldAngle.toFixed(1)}°`]);
          mRows.push(['  Left', `${field.leftAngle.toFixed(1)}°`]);
          mRows.push(['  Right', `${field.rightAngle.toFixed(1)}°`]);
        }
        y = this.table(doc, y, mRows);

        // Polar Distribution Chart
        y += 6;
        const chartSize = 175;
        const chartX = (w - chartSize) / 2;
        if (y + chartSize + 20 > 297) { doc.addPage(); y = 20; }
        y = this.sectionHeader(doc, 'Polar Distribution Chart', y);
        await this.drawPolarToPdf(doc, chartX, y, chartSize, iesData.verticalAngles, cData, peak);
        y += chartSize + 10;
      } catch {
        doc.setFontSize(10);
        doc.setTextColor(...GRAY);
        doc.text('Unable to parse IES file.', 20, y);
      }
    }

    doc.save(`LuxScale_Solution_${luminaireName.replace(/\s+/g, '_')}.pdf`);
  }

  // ─── Shared Report Sections ────────────────────────────────────────

  private addTitleBanner(doc: jsPDF, w: number, title: string, line1: string, line2: string): number {
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, w, 42, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 20, 17);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(line1, 20, 26);
    doc.text(line2, 20, 32);
    doc.setFontSize(8);
    doc.text(`Generated ${new Date().toLocaleDateString()}`, 20, 39);
    return 52;
  }

  private addProjectInfo(doc: jsPDF, y: number, response: CalculationResponse): number {
    y = this.sectionHeader(doc, 'Project Information', y);
    return this.table(doc, y, [
      ['Project Name', response.project_info.project_name],
      ['Company', response.project_info.company],
      ['Contact Name', response.project_info.name],
      ['Email', response.project_info.email],
      ['Phone', response.project_info.phone],
      ['Mounting Height', `${response.project_info.mounting_height} m`],
      ['Notes', response.project_info.notes || '—'],
    ]);
  }

  private addRoomDimensions(doc: jsPDF, y: number, response: CalculationResponse): number {
    y += 4;
    y = this.sectionHeader(doc, 'Room Dimensions', y);
    return this.table(doc, y, [
      ['Width', `${response.width} m`],
      ['Length', `${response.length} m`],
      ['Area', `${(response.width * response.length).toFixed(1)} m²`],
    ]);
  }

  private addStandard(doc: jsPDF, y: number, response: CalculationResponse): number {
    y += 4;
    y = this.sectionHeader(doc, 'Standard', y);
    const s = response.standard_row;
    const rows: string[][] = [
      ['Reference', s.ref_no],
      ['Task / Activity', s.task_or_activity],
      ['Category', `${s.category_base} — ${s.category_sub}`],
      ['Table', s.table],
      ['E_m (ceiling)', `${s.Em_ceiling_lx} lx`],
      ['E_m (room)', `${s.Em_r_lx} lx`],
      ['E_z', `${s.Ez_lx} lx`],
      ['Uo (required)', `${s.Uo}`],
      ['Ra (min)', `${s.Ra}`],
      ['RUGL', `${s.RUGL}`],
    ];
    if (s.tcp_min_K && s.tcp_max_K) {
      rows.push(['TCP Range', `${s.tcp_min_K}K - ${s.tcp_max_K}K`]);
    } else if (s.tcp_min_K) {
      rows.push(['TCP', `${s.tcp_min_K}K`]);
    } else if (s.tcp_max_K) {
      rows.push(['TCP', `${s.tcp_max_K}K`]);
    }
    if (s.specific_requirements) {
      rows.push(['Specific Requirements', s.specific_requirements]);
    }
    return this.table(doc, y, rows);
  }

  private addCalculationMeta(doc: jsPDF, y: number, response: CalculationResponse): number {
    y += 4;
    y = this.sectionHeader(doc, 'Calculation Details', y);
    const m = response.calculation_meta;
    return this.table(doc, y, [
      ['Mode', m.calc_mode],
      ['Total Solutions', `${m.total_solutions_returned}`],
      ['Fixture Count Step', `${m.fixture_count_step}`],
      ['Max Solutions Cap', `${m.max_solutions_cap}`],
      ['Compliant Cap Only', m.compliant_cap_only ? 'Yes' : 'No'],
      ['Capped at Max', m.capped_at_max ? 'Yes' : 'No'],
      ['No Compliant Options', m.no_compliant_options ? 'Yes' : 'No'],
    ]);
  }

  private addSolutionHeader(doc: jsPDF, w: number, y: number, num: number, result: CalculationResult): number {
    doc.setFillColor(...PRIMARY);
    doc.roundedRect(15, y - 5, w - 30, 10, 2, 2, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Solution ${num}: ${result['Luminaire']}`, 20, y + 2);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(result['is_compliant'] ? 'COMPLIANT' : 'NON-COMPLIANT', w - 20, y + 2, { align: 'right' });
    return y + 14;
  }

  private async addFixtureDetails(doc: jsPDF, y: number, fixture: any): Promise<number> {
    y += 4;
    y = this.sectionHeader(doc, 'Fixture Details', y);

    if (fixture.product.images.length > 0) {
      try {
        const imgData = await this.loadImage(fixture.product.images[0]);
        if (imgData) {
          doc.setFillColor(245, 245, 245);
          doc.roundedRect(15, y, 38, 38, 2, 2, 'F');
          doc.addImage(imgData, 'JPEG', 17, y + 2, 34, 34);
        }
      } catch { /* skip */ }
    }

    const fx = fixture.product.images.length > 0 ? 58 : 15;
    return this.table(doc, y, [
      ['Luminaire', fixture.product.title],
      ['Series', fixture.product.series],
      ['Category', fixture.product.category],
      ['Power', `${fixture.power_w} W`],
      ['Beam Angle', fixture.product.specs.beam_angle],
      ['CCT', fixture.product.specs.cct],
      ['Chip', fixture.product.specs.chip],
      ['Driver', fixture.product.specs.driver],
      ['Efficacy', fixture.product.specs.luminous_efficacy],
      ['Power Factor', fixture.product.specs.power_factor],
      ['Input Voltage', fixture.product.specs.input_voltage],
      ['Protection', fixture.product.specs.protection],
      ['Lifetime', fixture.product.specs.lifetime],
      ['Warranty', fixture.product.specs.warranty],
    ], fx);
  }

  private addCalculations(doc: jsPDF, y: number, result: CalculationResult): number {
    y += 6;
    y = this.sectionHeader(doc, 'Calculations', y, 10);

    y = this.subHeader(doc, 'Luminaire & Layout', y);
    y = this.table(doc, y, [
      ['Luminaire', `${result['Luminaire']}`],
      ['Power', `${result['Power (W)']} W`],
      ['Number of Fixtures', `${result['Fixtures']}`],
      ['Fixtures per m²', `${result['Fixtures per m²']}`],
      ['Layout Grid', `${result['Layout grid']}`],
      ['Spacing X', `${result['Spacing X (m)']} m`],
      ['Spacing Y', `${result['Spacing Y (m)']} m`],
      ['Beam Angle', `${result['Beam Angle (°)']}°`],
      ['Beam Angle Nominal', `${result['Beam Angle nominal (°)']}°`],
      ['IES File', `${result['IES file']}`],
    ]);

    y += 4;
    y = this.subHeader(doc, 'Performance', y);
    y = this.table(doc, y, [
      ['Luminous Efficacy', `${result['Efficacy (lm/W)']} lm/W`],
      ['IES Lumens', `${result['IES lumens (lm)']} lm`],
      ['Total Power', `${result['Total Power (W/H)']} W`],
      ['Maintenance Factor', `${result['Maintenance factor']}`],
    ]);

    y += 4;
    y = this.subHeader(doc, 'Illuminance', y);
    y = this.table(doc, y, [
      ['Average (E_avg)', `${result['Average Lux']} lx`],
      ['E_avg on Grid', `${result['E_avg_grid_lx']} lx`],
      ['E_min on Grid', `${result['E_min_grid_lx']} lx`],
      ['E_max on Grid', `${result['E_max_grid_lx']} lx`],
      ['Beam Source', `${result['Beam source']}`],
    ]);

    y += 4;
    y = this.subHeader(doc, 'Uniformity & Compliance', y);
    const uRows: string[][] = [
      ['Calculated Uo', `${result['U0_calculated']}`],
      ['Standard Uo (required)', `${result['Uniformity']}`],
      ['U1 (E_min/E_max)', `${result['U1_calculated']}`],
      ['Lux Gap', `${result['Lux gap']}`],
      ['U0 Gap', `${result['U0 gap']}`],
    ];
    if (result['Standard margin (U0 %)'] !== undefined)
      uRows.push(['U0 Margin', `${result['Standard margin (U0 %)']}%`]);
    if (result['Standard margin (lux %)'] !== undefined)
      uRows.push(['Lux Margin', `${result['Standard margin (lux %)']}%`]);
    y = this.table(doc, y, uRows);

    y += 4;
    y = this.subHeader(doc, 'Selection Details', y);
    return this.table(doc, y, [
      ['How Chosen', `${result['Selection']}`],
      ['Lux Compliance Basis', `${result['Lux compliance basis']}`],
      ['Room Reflectance', `${result['Room reflectance preset']}`],
      ['Inter-reflection Fraction', `${result['Inter-reflection fraction (est.)']}`],
    ]);
  }

  // ─── Layout Helpers ────────────────────────────────────────────────

  private sectionHeader(doc: jsPDF, title: string, y: number, fontSize = 11): number {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFillColor(...PRIMARY);
    doc.roundedRect(15, y - 4, 3, 8, 1, 1, 'F');
    doc.setTextColor(...PRIMARY);
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 22, y + 1);
    return y + 12;
  }

  private subHeader(doc: jsPDF, title: string, y: number): number {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setTextColor(...BLACK);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), 20, y);
    return y + 5;
  }

  private table(doc: jsPDF, y: number, rows: string[][], startX = 15): number {
    if (rows.length === 0) return y;
    if (y > 245) { doc.addPage(); y = 20; }

    const sanitized = rows.map(([k, v]) => [sanitize(k), sanitize(v)]);

    const rightEdge = 195;
    const availableWidth = rightEdge - startX;
    const col0Width = startX > 15 ? 35 : 55;
    const col1Width = availableWidth - col0Width;

    autoTable(doc, {
      startY: y,
      margin: { left: startX, right: 15 },
      tableWidth: availableWidth,
      head: [],
      body: sanitized,
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        textColor: [...BLACK],
        lineColor: [...LIGHT_GRAY],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: col0Width, textColor: [...GRAY] },
        1: { cellWidth: col1Width, overflow: 'linebreak' },
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    return (doc as any).lastAutoTable.finalY + 4;
  }

  // ─── Polar Curve (SVG → jsPDF vector) ──────────────────────────────

  private buildPolarSvg(
    verticalAngles: number[],
    candelaValues: number[],
    maxCandela: number,
  ): SVGSVGElement {
    const size = 500;
    const c = size / 2;
    const R = 180;
    const labelR = R + 22;

    const outerValue = Math.ceil(maxCandela / 500) * 500;
    const rawStep = outerValue / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    let niceStep = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    if (niceStep < 500) niceStep = 500;
    const scaleSteps: number[] = [];
    for (let v = niceStep; v < outerValue; v += niceStep) scaleSteps.push(Math.round(v));
    scaleSteps.push(outerValue);

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('xmlns', ns);

    // Dark background
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', String(size));
    bg.setAttribute('height', String(size));
    bg.setAttribute('fill', '#111318');
    svg.appendChild(bg);

    // Concentric circles
    for (const v of scaleSteps) {
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', String(c));
      circle.setAttribute('cy', String(c));
      circle.setAttribute('r', String((v / outerValue) * R));
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', '#2a2d35');
      circle.setAttribute('stroke-width', '0.7');
      svg.appendChild(circle);
    }

    // Radial lines
    for (let a = 0; a < 360; a += 15) {
      const rad = (a - 90) * Math.PI / 180;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', String(c));
      line.setAttribute('y1', String(c));
      line.setAttribute('x2', String(c + R * Math.cos(rad)));
      line.setAttribute('y2', String(c + R * Math.sin(rad)));
      line.setAttribute('stroke', '#1e2028');
      line.setAttribute('stroke-width', '0.5');
      svg.appendChild(line);
    }

    // Angle labels
    for (let a = 0; a < 360; a += 15) {
      const rad = (a - 90) * Math.PI / 180;
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', String(c + labelR * Math.cos(rad)));
      text.setAttribute('y', String(c + labelR * Math.sin(rad)));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', '#5a5e6a');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
      text.textContent = `${a}°`;
      svg.appendChild(text);
    }

    // Candela curve polygon
    const right: string[] = [];
    const left: string[] = [];
    for (let i = 0; i < candelaValues.length; i++) {
      const gamma = verticalAngles[i];
      const r = (candelaValues[i] / outerValue) * R;
      const radR = (gamma - 90) * Math.PI / 180;
      right.push(`${(c + r * Math.cos(radR)).toFixed(2)},${(c + r * Math.sin(radR)).toFixed(2)}`);
      const radL = (-gamma - 90) * Math.PI / 180;
      left.push(`${(c + r * Math.cos(radL)).toFixed(2)},${(c + r * Math.sin(radL)).toFixed(2)}`);
    }
    const polygon = document.createElementNS(ns, 'polygon');
    polygon.setAttribute('points', [...right, ...left.reverse()].join(' '));
    polygon.setAttribute('fill', 'rgba(185, 35, 42, 0.15)');
    polygon.setAttribute('stroke', '#c4303a');
    polygon.setAttribute('stroke-width', '1.4');
    polygon.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(polygon);

    // Center dot
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', String(c));
    dot.setAttribute('cy', String(c));
    dot.setAttribute('r', '2.5');
    dot.setAttribute('fill', '#c4303a');
    svg.appendChild(dot);

    // Connecting lines from circles to labels
    const labelY = c + R + 30;
    for (const v of scaleSteps) {
      const x = c + (v / outerValue) * R;
      const circleBottom = c + (v / outerValue) * R;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', String(x));
      line.setAttribute('y1', String(circleBottom));
      line.setAttribute('x2', String(x));
      line.setAttribute('y2', String(labelY - 2));
      line.setAttribute('stroke', '#2a2d35');
      line.setAttribute('stroke-width', '0.5');
      line.setAttribute('stroke-dasharray', '2,2');
      svg.appendChild(line);
    }

    // Scale labels along bottom
    for (const val of scaleSteps) {
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', String(c + (val / outerValue) * R));
      text.setAttribute('y', String(c + R + 38));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#7a7e8a');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
      text.textContent = String(val);
      svg.appendChild(text);
    }

    return svg;
  }

  private async drawPolarToPdf(
    doc: jsPDF,
    x: number,
    y: number,
    chartSize: number,
    verticalAngles: number[],
    candelaValues: number[],
    maxCandela: number,
  ): Promise<void> {
    const svg = this.buildPolarSvg(verticalAngles, candelaValues, maxCandela);
    // svg2pdf.js scales from SVG units to PDF mm
    const scale = chartSize / 500;
    await doc.svg(svg, { x, y, width: chartSize, height: chartSize });
  }

  private async loadImage(url: string): Promise<string | null> {
    const filename = url.split('/').pop()?.split('?')[0] ?? '';
    const proxyUrl = `https://shortcircuit.company/assets/img/products/image_proxy.php?file=${encodeURIComponent(filename)}`;
    try {
      const res = await fetch(proxyUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string | null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }
}

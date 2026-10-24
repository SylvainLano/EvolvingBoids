// ChartRenderer.ts
import type { StatsSample } from './Statistics';

interface Series {
  label: string;
  values: number[];
  color: string;
  unit: string;
}

// Live charts of the populations and of the average genes, drawn on a small canvas
export class ChartRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private pixelRatio = 1;

  private readonly padding = 10;
  private readonly titleHeight = 14;
  private readonly minVisibleSamples = 60;    // the first minute is drawn on a fixed scale, then the whole history fits the width
  private readonly minDeviationRange = 10;    // smallest range of the gene charts, in percent

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  private fitToDisplaySize() {
    const pixelRatio = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === this.width && height === this.height && pixelRatio === this.pixelRatio) {
      return;
    }
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  render(samples: StatsSample[], darkMode: boolean) {
    this.fitToDisplaySize();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const boidColor = darkMode ? '#8c8cff' : 'blue';
    const predatorColor = darkMode ? '#ff9b96' : 'red';
    const foodColor = darkMode ? '#2dd4bf' : '#22a05a';
    const plantColor = darkMode ? '#86efac' : '#15803d';
    const textColor = darkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)';
    const gridColor = darkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
    const winterColor = darkMode ? 'rgba(148, 197, 255, 0.1)' : 'rgba(30, 64, 175, 0.07)';
    const winters = samples.map(s => s.winter);

    const rowHeight = (this.height - this.padding) / 4;
    const rows: { title: string, series: Series[], deviation: boolean }[] = [
      {
        title: 'Population',
        deviation: false,
        series: [
          { label: 'Boids', values: samples.map(s => s.boids), color: boidColor, unit: '' },
          { label: 'Predators', values: samples.map(s => s.predators), color: predatorColor, unit: '' },
          { label: 'Food', values: samples.map(s => s.food), color: foodColor, unit: '%' },
          { label: 'Plants', values: samples.map(s => s.plants), color: plantColor, unit: '' },
        ],
      },
      {
        title: 'Speed',
        deviation: true,
        series: [
          { label: 'Boids', values: samples.map(s => s.boidSpeed), color: boidColor, unit: '%' },
          { label: 'Predators', values: samples.map(s => s.predatorSpeed), color: predatorColor, unit: '%' },
        ],
      },
      {
        title: 'Fertility',
        deviation: true,
        series: [
          { label: 'Boids', values: samples.map(s => s.boidFertility), color: boidColor, unit: '%' },
          { label: 'Predators', values: samples.map(s => s.predatorFertility), color: predatorColor, unit: '%' },
        ],
      },
      {
        title: 'Vision',
        deviation: true,
        series: [
          { label: 'Boids', values: samples.map(s => s.boidVision), color: boidColor, unit: '%' },
          { label: 'Predators', values: samples.map(s => s.predatorVision), color: predatorColor, unit: '%' },
        ],
      },
    ];

    rows.forEach((row, index) => {
      const top = this.padding + index * rowHeight;
      this.drawRow(row.title, row.series, row.deviation, top, rowHeight - this.padding, textColor, gridColor, winters, winterColor);
    });
  }

  // Populations are each scaled to their own maximum, genes share a symmetric scale around the species default
  // The winters are shaded behind the lines
  private drawRow(title: string, series: Series[], deviation: boolean, top: number, height: number, textColor: string, gridColor: string,
    winters: boolean[], winterColor: string) {
    const ctx = this.ctx;
    const left = this.padding;
    const plotWidth = this.width - this.padding * 2;
    const plotTop = top + this.titleHeight;
    const plotHeight = height - this.titleHeight;
    // A series without any value (the food without plankton) is not drawn at all
    series = series.filter(s => s.values.length === 0 || s.values.some(Number.isFinite));

    const count = Math.max(winters.length - 1, this.minVisibleSamples);
    ctx.fillStyle = winterColor;
    winters.forEach((winter, i) => {
      if (winter) {
        ctx.fillRect(left + (i / count) * plotWidth, plotTop, plotWidth / count + 0.5, plotHeight);
      }
    });

    // Title, then the latest value of each series on the right
    ctx.font = '10px Monaco, monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = textColor;
    ctx.fillText(title, left, top);
    ctx.textAlign = 'right';
    let right = this.width - this.padding;
    for (const s of [...series].reverse()) {
      const last = s.values[s.values.length - 1];
      const text = Number.isFinite(last) ? `${deviation && last > 0 ? '+' : ''}${Math.round(last)}${s.unit}` : '-';
      ctx.fillStyle = s.color;
      ctx.fillText(text, right, top);
      right -= ctx.measureText(text).width + 12;
    }

    // Scale
    const finiteValues = series.flatMap(s => s.values.filter(Number.isFinite));
    const range = deviation
      ? Math.max(this.minDeviationRange, ...finiteValues.map(Math.abs))
      : 0;
    const toY = (value: number, max: number) => deviation
      ? plotTop + plotHeight / 2 - (value / range) * (plotHeight / 2)
      : plotTop + plotHeight - (value / max) * plotHeight;

    // Baseline: the species default for genes, zero for populations
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash(deviation ? [3, 3] : []);
    ctx.beginPath();
    const baseline = Math.round(deviation ? plotTop + plotHeight / 2 : plotTop + plotHeight) + 0.5;
    ctx.moveTo(left, baseline);
    ctx.lineTo(left + plotWidth, baseline);
    ctx.stroke();
    ctx.setLineDash([]);

    // Lines, broken where a value is missing (extinct species)
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    for (const s of series) {
      const count = Math.max(s.values.length - 1, this.minVisibleSamples);
      const max = Math.max(1, ...s.values.filter(Number.isFinite));
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      let drawing = false;
      s.values.forEach((value, i) => {
        if (!Number.isFinite(value)) {
          drawing = false;
          return;
        }
        const x = left + (i / count) * plotWidth;
        const y = toY(value, max);
        if (drawing) {
          ctx.lineTo(x, y);
        } else {
          ctx.moveTo(x, y);
          drawing = true;
        }
      });
      ctx.stroke();
    }
  }
}

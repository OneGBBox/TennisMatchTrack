import {
  Component,
  OnDestroy,
  effect,
  input,
  ElementRef,
  viewChild
} from '@angular/core';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  ChartDataset,
  ChartOptions
} from 'chart.js';
import { MomentumPoint } from '../../../services/stats.service';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip
);

@Component({
  selector: 'app-momentum-chart',
  standalone: true,
  template: `
    <div class="chart-wrap">
      <canvas #canvas></canvas>
    </div>
  `,
  styles: [`
    .chart-wrap {
      position: relative;
      width: 100%;
      height: 220px;
    }
    canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
    }
  `]
})
export class MomentumChartComponent implements OnDestroy {
  data       = input<MomentumPoint[]>([]);
  /** Indices where a new set starts (for vertical dividers) */
  setBreaks  = input<number[]>([]);
  p1Name     = input<string>('P1');
  p2Name     = input<string>('P2');

  canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private chart: Chart | null = null;

  constructor() {
    effect(() => {
      const pts = this.data();
      if (!pts.length) return;
      this.renderChart(pts);
    });
  }

  private renderChart(pts: MomentumPoint[]): void {
    const canvas = this.canvasRef().nativeElement;
    if (!canvas) return;

    const labels = pts.map(p => p.label);
    const values = pts.map(p => p.ema);

    if (this.chart) {
      this.chart.data.labels = labels;
      (this.chart.data.datasets[0] as ChartDataset<'line'>).data = values;
      this.chart.update('none');
      return;
    }

    // ── build set-boundary annotation annotations ──────────────────────────
    // (Chart.js annotation plugin is not installed; draw boundaries via
    // afterDraw plugin instead)
    const setBreakIdxs = this.setBreaks();

    const setLinePlugin = {
      id: 'setLines',
      afterDraw: (chart: Chart) => {
        const ctx   = chart.ctx;
        const xAxis = chart.scales['x'];
        const yAxis = chart.scales['y'];
        if (!xAxis || !yAxis) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth   = 1;
        ctx.setLineDash([4, 4]);
        for (const idx of setBreakIdxs) {
          const x = xAxis.getPixelForValue(idx);
          ctx.beginPath();
          ctx.moveTo(x, yAxis.top);
          ctx.lineTo(x, yAxis.bottom);
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    const options: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y ?? 0;
              const side = v >= 0 ? this.p1Name() : this.p2Name();
              return `${side} momentum: ${v.toFixed(1)}`;
            }
          }
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          grid: {
            color: ctx => ctx.tick.value === 0
              ? 'rgba(255,255,255,0.5)'
              : 'rgba(255,255,255,0.08)'
          },
          ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 10 } }
        }
      }
    };

    this.chart = new Chart(canvas, {
      type: 'line',
      plugins: [setLinePlugin],
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: '#4FC3F7',
          backgroundColor: (ctx) => {
            const gradient = canvas.getContext('2d')!
              .createLinearGradient(0, 0, 0, 220);
            gradient.addColorStop(0,   'rgba(79,195,247,0.35)');
            gradient.addColorStop(0.5, 'rgba(79,195,247,0.05)');
            gradient.addColorStop(1,   'rgba(79,195,247,0.0)');
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}

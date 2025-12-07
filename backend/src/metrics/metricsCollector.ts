/**
 * Metrics Collector
 * Collects and exposes application metrics
 * In production, integrate with Prometheus or similar
 */

import { logger } from '../utils/logger';

interface Metric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
}

class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key) || [];
    
    const lastMetric = existing[existing.length - 1];
    const newValue = lastMetric ? lastMetric.value + 1 : 1;
    
    existing.push({
      name,
      value: newValue,
      labels,
      timestamp: new Date(),
    });
    
    // Keep only last 1000 metrics per key
    if (existing.length > 1000) {
      existing.shift();
    }
    
    this.metrics.set(key, existing);
  }

  /**
   * Record a gauge metric
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key) || [];
    
    existing.push({
      name,
      value,
      labels,
      timestamp: new Date(),
    });
    
    // Keep only last 1000 metrics per key
    if (existing.length > 1000) {
      existing.shift();
    }
    
    this.metrics.set(key, existing);
  }

  /**
   * Record a histogram metric
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.setGauge(name, value, labels);
  }

  /**
   * Get metric value
   */
  getMetric(name: string, labels?: Record<string, string>): number | null {
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key);
    
    if (!existing || existing.length === 0) {
      return null;
    }
    
    return existing[existing.length - 1].value;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const [key, metrics] of this.metrics.entries()) {
      if (metrics.length > 0) {
        result[key] = metrics[metrics.length - 1].value;
      }
    }
    
    return result;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics.clear();
  }

  /**
   * Get metric key from name and labels
   */
  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels) {
      return name;
    }
    
    const labelParts = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    
    return `${name}{${labelParts}}`;
  }
}

// Export singleton instance
export const metrics = new MetricsCollector();

// Helper functions for common metrics
export function recordUpload(status: string, fileType: string): void {
  metrics.incrementCounter('uploads_total', { status, file_type: fileType });
}

export function recordUploadDuration(durationSeconds: number, status: string): void {
  metrics.recordHistogram('upload_duration_seconds', durationSeconds, { status });
}

export function recordChunkUpload(status: string): void {
  metrics.incrementCounter('chunks_uploaded_total', { status });
}

export function recordActiveUploads(count: number): void {
  metrics.setGauge('active_uploads', count);
}

/**
 * Get metrics summary for monitoring
 */
export function getMetricsSummary(): Record<string, unknown> {
  return {
    metrics: metrics.getAllMetrics(),
    timestamp: new Date().toISOString(),
  };
}


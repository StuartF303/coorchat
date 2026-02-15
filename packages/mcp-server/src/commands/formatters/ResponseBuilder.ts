/**
 * ResponseBuilder
 * Helper utilities for building structured command responses
 */

export class ResponseBuilder {
  /**
   * Format a table from data objects
   * @param data Array of objects with consistent keys
   * @param columns Column keys to include (optional - uses all if not specified)
   * @returns Headers and rows for table formatting
   */
  static buildTable<T extends Record<string, any>>(
    data: T[],
    columns?: (keyof T)[]
  ): { headers: string[]; rows: string[][] } {
    if (data.length === 0) {
      return { headers: [], rows: [] };
    }

    // Determine columns
    const cols = columns || (Object.keys(data[0]) as (keyof T)[]);

    // Build headers (capitalize first letter)
    const headers = cols.map(col =>
      String(col).charAt(0).toUpperCase() + String(col).slice(1)
    );

    // Build rows
    const rows = data.map(item =>
      cols.map(col => String(item[col] ?? ''))
    );

    return { headers, rows };
  }

  /**
   * Format key-value pairs from an object
   * @param data Object with string values
   * @param keyTransform Optional function to transform keys
   * @returns Formatted sections
   */
  static buildSections(
    data: Record<string, any>,
    keyTransform?: (key: string) => string
  ): Record<string, string> {
    const sections: Record<string, string> = {};

    for (const [key, value] of Object.entries(data)) {
      const displayKey = keyTransform ? keyTransform(key) : key;
      sections[displayKey] = String(value);
    }

    return sections;
  }

  /**
   * Format elapsed time in human-readable format
   * @param seconds Elapsed seconds
   * @returns Human-readable time string
   */
  static formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ${Math.round(seconds % 60)}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  /**
   * Format timestamp as relative time ("5 minutes ago")
   * @param timestamp ISO 8601 timestamp
   * @returns Relative time string
   */
  static formatRelativeTime(timestamp: string): string {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) {
      return 'just now';
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  /**
   * Format percentage
   * @param value Value between 0 and 1
   * @param decimals Number of decimal places (default: 1)
   * @returns Formatted percentage string
   */
  static formatPercentage(value: number, decimals: number = 1): string {
    return `${(value * 100).toFixed(decimals)}%`;
  }

  /**
   * Format large numbers with commas
   * @param value Number to format
   * @returns Formatted number string
   */
  static formatNumber(value: number): string {
    return value.toLocaleString();
  }

  /**
   * Truncate text with ellipsis
   * @param text Text to truncate
   * @param maxLength Maximum length
   * @returns Truncated text
   */
  static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Group items by a key
   * @param items Array of items
   * @param keyFn Function to extract grouping key
   * @returns Map of grouped items
   */
  static groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();

    for (const item of items) {
      const key = keyFn(item);
      const existing = groups.get(key) || [];
      existing.push(item);
      groups.set(key, existing);
    }

    return groups;
  }
}

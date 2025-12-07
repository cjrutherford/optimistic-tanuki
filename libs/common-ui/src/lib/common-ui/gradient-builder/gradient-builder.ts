export type GradientType =
  | 'linear'
  | 'conic'
  | 'radial'
  | 'repeating-linear'
  | 'repeating-conic'
  | 'repeating-radial';

export interface GradientBuilderOptions {
  angle?: string;
  direction?: string;
  shape?: string;
  size?: string;
  position?: string;
  colors: string[];
}

export class GradientBuilder {
  private type: GradientType = 'linear';
  private options: GradientBuilderOptions = { colors: [] };

  setType(type: GradientType): this {
    this.type = type;
    return this;
  }

  setOptions(options: GradientBuilderOptions): this {
    this.options = options;
    return this;
  }

  build(): string {
    const { angle, direction, shape, size, position, colors } = this.options;
    switch (this.type) {
      case 'linear':
        return this.linearGradient(colors, direction ?? angle ?? '90deg');
      case 'repeating-linear':
        return this.repeatingLinearGradient(
          colors,
          direction ?? angle ?? '90deg'
        );
      case 'conic':
        return this.conicGradient(
          colors,
          angle ?? '0deg',
          position ?? '50% 50%'
        );
      case 'repeating-conic':
        return this.repeatingConicGradient(
          colors,
          angle ?? '0deg',
          position ?? '50% 50%'
        );
      case 'radial':
        return this.radialGradient(
          colors,
          shape ?? 'ellipse',
          size ?? '',
          position ?? '50% 50%'
        );
      case 'repeating-radial':
        return this.repeatingRadialGradient(
          colors,
          shape ?? 'ellipse',
          size ?? '',
          position ?? '50% 50%'
        );
      default:
        return '';
    }
  }

  private linearGradient(colors: string[], angle: string): string {
    return `linear-gradient(${angle}, ${colors.join(', ')})`;
  }

  private conicGradient(
    colors: string[],
    angle: string,
    position: string
  ): string {
    return `conic-gradient(from ${angle} at ${position}, ${colors.join(', ')})`;
  }

  private radialGradient(
    colors: string[],
    shape: string,
    size: string,
    position: string
  ): string {
    return `radial-gradient(${shape} ${size} at ${position}, ${colors.join(
      ', '
    )})`;
  }

  private repeatingLinearGradient(colors: string[], angle: string): string {
    return `repeating-linear-gradient(${angle}, ${colors.join(', ')})`;
  }

  private repeatingConicGradient(
    colors: string[],
    angle: string,
    position: string
  ): string {
    return `repeating-conic-gradient(from ${angle} at ${position}, ${colors.join(
      ', '
    )})`;
  }

  private repeatingRadialGradient(
    colors: string[],
    shape: string,
    size: string,
    position: string
  ): string {
    return `repeating-radial-gradient(${shape} ${size} at ${position}, ${colors.join(
      ', '
    )})`;
  }
}

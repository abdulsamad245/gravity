/** Object-linked connector routing styles (stored on CanvasObject.connectorStyle). */
export const CONNECTOR_STYLES = ['straight', 'elbow', 'curved', 'polyline'] as const;
export type ConnectorStyle = (typeof CONNECTOR_STYLES)[number];

export const CONNECTOR_STYLE_LABELS: Record<ConnectorStyle, string> = {
  straight: 'Straight',
  elbow: 'Right angle',
  curved: 'Curved',
  polyline: 'Polyline',
};

export const DEFAULT_CONNECTOR_STYLE: ConnectorStyle = 'straight';

export function isConnectorStyle(value: unknown): value is ConnectorStyle {
  return typeof value === 'string' && (CONNECTOR_STYLES as readonly string[]).includes(value);
}

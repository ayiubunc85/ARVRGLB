declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        'auto-rotate'?: boolean | string;
        'auto-rotate-delay'?: string;
        'rotation-per-second'?: string;
        'camera-controls'?: boolean | string;
        'disable-zoom'?: boolean | string;
        'interaction-prompt'?: string;
        'shadow-intensity'?: string;
        'environment-image'?: string;
        'camera-orbit'?: string;
        poster?: string;
      },
      HTMLElement
    >;
  }
}

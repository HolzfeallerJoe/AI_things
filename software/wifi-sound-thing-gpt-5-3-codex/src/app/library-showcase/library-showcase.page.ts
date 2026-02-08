import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import type { SegmentValue } from '@ionic/angular';

interface LibraryDemo {
  id: string;
  name: string;
  description: string;
  highlights: string[];
  iframeSrc: string;
}

@Component({
  selector: 'app-library-showcase',
  templateUrl: './library-showcase.page.html',
  styleUrls: ['./library-showcase.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
})
export class LibraryShowcasePage {
  theme: 'neon' | 'contrast' | 'pastel' = 'neon';

  readonly libraryDemos: LibraryDemo[] = [
    {
      id: 'tamagui',
      name: 'Tamagui',
      description:
        'Cross-platform design system with React Native roots. Focuses on tokens, responsive design, and punchy gradients.',
      highlights: [
        'Token-driven theming with responsive props',
        'Prebuilt primitives for stacks, cards, and forms',
        'Great for animated, high-density dashboards',
      ],
      iframeSrc: 'assets/ui-demos/tamagui-demo.html',
    },
    {
      id: 'nebular',
      name: 'Nebular',
      description:
        'Angular-first UI kit from Akveo with Eva design language. Ships with multiple professional dark/light themes.',
      highlights: [
        'Rich set of enterprise components (auth, lists, cards)',
        'Customizable themes via SCSS variables',
        'Tight integration with Angular CDK',
      ],
      iframeSrc: 'assets/ui-demos/nebular-demo.html',
    },
    {
      id: 'shoelace',
      name: 'Shoelace',
      description:
        'Framework-agnostic Web Components backed by Shadow DOM. Excellent documentation and theming via CSS custom properties.',
      highlights: [
        'Works in any framework (just include Web Components)',
        'Accessible by default and themeable with CSS vars',
        'Rich icon library and form controls',
      ],
      iframeSrc: 'assets/ui-demos/shoelace-demo.html',
    },
    {
      id: 'daisyui',
      name: 'DaisyUI',
      description:
        'Tailwind CSS plugin with whimsical, themeable components. Great for playful or retro-inspired apps.',
      highlights: [
        '14+ built-in themes with effortless switching',
        'Includes forms, alerts, cards, drawers, and more',
        'Tailwind utility classes keep markup compact',
      ],
      iframeSrc: 'assets/ui-demos/daisyui-demo.html',
    },
    {
      id: 'flowbite',
      name: 'Flowbite',
      description:
        'Tailwind-driven component suite focused on dashboards and SaaS UX with polished typography.',
      highlights: [
        'Includes complex patterns like timelines and tables',
        'Ships with React, Vue, and Svelte bindings',
        'Strong documentation and Figma resources',
      ],
      iframeSrc: 'assets/ui-demos/flowbite-demo.html',
    },
  ];

  updateTheme(value: SegmentValue | undefined): void {
    if (value === 'neon' || value === 'contrast' || value === 'pastel') {
      this.theme = value;
    }
  }
}

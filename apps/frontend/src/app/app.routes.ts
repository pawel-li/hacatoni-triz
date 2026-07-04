import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./home/home').then((m) => m.HomeComponent),
  },
  {
    path: 'diagram',
    loadComponent: () =>
      import('./diagram/ui/diagram-page/diagram-page').then(
        (m) => m.DiagramPageComponent
      ),
  },
  {
    path: 'prompts/:id',
    loadComponent: () =>
      import('./prompts/ui/prompt-diagram-page/prompt-diagram-page').then(
        (m) => m.PromptDiagramPageComponent
      ),
  },
];


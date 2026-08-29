import { DeveloperToolsPlugin } from '@soeditor/dev-tools';
import { FileManagerPlugin } from '@soeditor/file-manager';
import {
    AccessibilityDiagnosticsPlugin,
    SeoDiagnosticsPlugin,
} from '@soeditor/html-tools';
import { SplitViewPlugin } from '@soeditor/layout';
import { ProjectionCoordinatorPlugin } from '@soeditor/projections';
import { defaultToolbarConfiguration } from '@soeditor/ui';

import { classicPreset } from './classic.js';
import { createPreset } from './create-preset.js';

export const developerPreset = createPreset(
    'html',
    [
        ...classicPreset.plugins,
        AccessibilityDiagnosticsPlugin,
        SeoDiagnosticsPlugin,
        ProjectionCoordinatorPlugin,
        SplitViewPlugin,
        DeveloperToolsPlugin,
        FileManagerPlugin,
    ],
    [
        ...defaultToolbarConfiguration,
        '|',
        'problems',
        'image-browse',
        'inspector',
        'outline',
        'find-replace',
        'command-palette',
    ],
);

# React Visual Clone

A TypeScript CLI tool that creates visual-only clones of React component subtrees. This tool takes an existing React/React Native/Expo project, makes a full copy of it, and patches the copied app so it boots directly into a visual-only stripped clone of a chosen component subtree.

## Goal

- **Never modify the source project** - Always work on a copy
- **Create a full copied project** in a new output directory  
- **Generate a stripped "visual-only mirror"** of the chosen component subtree (or the entire project via `--mirror-all`)
- **Remove hooks/custom logic** from every mirrored component so the preview cannot crash from missing runtime data
- **Preserve JSX/layout/text/static styles** so the preview remains faithful to the original look
- **Keep ignored UI/layout components real** when you pass `--ignore`
- **Patch the copied app** so it boots into the mirrored subtree using `overwrite-shell` or a component replacement strategy

Because the transform is intentionally aggressive, mirrored components never accept props, call hooks, or access real data. Instead they render stable preview bindings (strings, numbers, arrays, objects) so that bundles succeed even when upstream state is unavailable.

## Installation

```bash
npm install -g react-visual-clone
```

Or build from source:

```bash
git clone <repository>
cd react-visual-clone
npm install
npm run build
npm link
```

## Usage

### Basic Example

```bash
react-visual-clone generate \
  --project-root /path/to/project \
  --target-component app/components/game/JoinedGames.tsx \
  --out /path/to/output
```

### Full Example

```bash
react-visual-clone generate \
  --project-root /Users/malachyfernandez/Documents/1-programing/apps-and-sites/wolfspoint/wolfspoint \
  --base-file app/index.tsx \
  --replace-component ./MainPage \
  --target-component app/components/games/PlayerPage.jsx \
  --out /Users/malachyfernandez/Desktop/wolfspoint-player-preview \
  --framework expo-router \
  --ignore app/components/ui,app/components/layout
```

## CLI Options

- `--project-root`: Source project root directory (required)
- `--base-file`: File inside the app that should be patched (default: `App.tsx`)
- `--replace-component`: Component inside base-file to replace with the preview root (optional)
- `--target-component`: Component file that becomes the root of the visual-only mirrored subtree (required)
- `--out`: Output path for copied project (required)
- `--framework`: Framework type: `expo-router`, `react-native`, or `react-web` (default: `react-web`)
- `--ignore`: Comma-separated folders that remain real and are never stripped
- `--mode`: Transformation mode (default: `visual-strip`)
- `--array-length`: Default array length for preview data (default: `1`)
- `--conditionals`: Whether conditionals should render visible content by default (default: `true`)
- `--string-default`: Default string value for preview (default: `Lorem ipsum`)
- `--number-default`: Default number value for preview (default: `1`)
- `--boolean-default`: Default boolean value for preview (default: `true`)
- `--image-placeholder`: Placeholder image URL (default: `https://via.placeholder.com/300x200`)
- `--mirror-all`: Mirror every component file (excluding ignored folders) so the preview environment never relies on untouched business logic

## What It Does

### Phase 1: Copy Project
- Copies the entire source project to a new output directory
- Excludes: `node_modules`, `.git`, `dist`, `build`, `.expo`, `coverage`, etc.
- Never modifies the source project

### Phase 2: Framework Detection
- Detects `expo-router` if `app/_layout.tsx` exists
- Detects `react-native` if `App.tsx` exists  
- Detects `react-web` if `src/App.tsx` exists
- Falls back to `react-web` if unsure

### Phase 3: Build Subtree Graph / Global Mirror
- Starting from the target component, recursively resolves local project component imports
- Only follows imports that are used as JSX components
- Marks components as `mirror-strip` or `opaque-real` based on ignore folders
- Stops at ignored folders, node_modules, and non-component helpers
- **Optional `--mirror-all`:** scans the entire project for additional `.tsx/.jsx` files and mirrors them too. This guarantees that no component accidentally falls back to real logic.

### Phase 4: Create Mirrored Files
- Creates `.visual-clone/mirrored/` directory in the copied project
- Mirrors each non-ignored component with **strict visual-strip transformations**:
  - Removes hooks (`useState`, `useEffect`, `useMemo`, router/auth/query hooks, etc.)
  - Removes business logic, effects, reducers, and API calls
  - Rewrites component signatures so mirrored components never take props
  - Replaces handlers with noops and replaces dynamic JSX expressions with preview bindings
  - Synthesizes preview data for every identifier the JSX references (strings, numbers, booleans, arrays, simple objects)
  - Preserves JSX structure, literal text, static props, and styles so the layout matches the source
- Mirrored files are intentionally deterministic and side-effect-free so repeated Expo/Web runs cannot regress due to missing data
 
### Verification Workflow
- `npm run build` inside `react-cloner`
- `node dist/cli-final.js generate ... --mirror-all --base-mode overwrite-shell` to produce a fresh preview copy
- `(cd preview && npm install)` to restore node_modules inside the copied project
- `npx expo start --web --port <port>` (or native equivalents) to confirm bundling/runtime success

This loop ensures every preview is produced from a clean slate and that the strict transform never leaves behind unmirrored logic.

### Phase 5: Patch Base File
- Either replaces a specific component in the base file or rewrites the default export
- Patches the copied app to render the mirrored target root component
- Preserves providers and wrappers above the patch point

## Transformation Example

### Original Component:
```tsx
import React from 'react';
import Column from '../layout/Column';
import PoppinsText from '../ui/text/PoppinsText';
import JoinedGameListItem from './JoinedGameListItem';

interface JoinedGamesProps {
    gamesTheyJoined: string[];
    setGamesTheyJoined: (games: string[]) => void;
    setActiveGameId: (gameId: string) => void;
}

const JoinedGames = ({
    gamesTheyJoined,
    setGamesTheyJoined,
    setActiveGameId,
}: JoinedGamesProps) => {
    return (
        <Column>
            <PoppinsText weight="bold">Joined Games</PoppinsText>

            <Column gap={0}>
                {gamesTheyJoined.map((game, index) => (
                    <JoinedGameListItem
                        key={game}
                        game={game}
                        index={index}
                        onLeave={() =>
                            setGamesTheyJoined(
                                gamesTheyJoined.filter((g) => g !== game)
                            )
                        }
                        setActiveGameId={setActiveGameId}
                    />
                ))}
            </Column>
        </Column>
    );
};

export default JoinedGames;
```

### Mirrored Visual-Only Component:
```tsx
import React from 'react';
import Column from '../layout/Column';
import PoppinsText from '../ui/text/PoppinsText';
import JoinedGameListItem from './JoinedGameListItem';

const __preview_gamesTheyJoined = ['Lorem ipsum'];
const __preview_setGamesTheyJoined = () => {};
const __preview_setActiveGameId = () => {};

const JoinedGames = () => {
    return (
        <Column>
            <PoppinsText weight="bold">Joined Games</PoppinsText>

            <Column gap={0}>
                {__preview_gamesTheyJoined.map((game, index) => (
                    <JoinedGameListItem
                        key={game}
                        game={game}
                        index={index}
                        onLeave={() => {}}
                        setActiveGameId={() => {}}
                    />
                ))}
            </Column>
        </Column>
    );
};

export default JoinedGames;
```

## Key Features

- **Never touches source project** - Always works on a copy
- **Visual-only transformations** - Strips all business logic, hooks, and API calls
- **Preserves visual structure** - Keeps JSX, text, styles, and component hierarchy
- **Smart prop synthesis** - Creates preview data for missing props
- **Ignored folder support** - Keeps UI/layout components real and untouched
- **Framework agnostic** - Works with React, React Native, and Expo Router
- **Safe defaults** - Uses conservative visual placeholders that won't crash

## Output Structure

```
output-directory/
├── .visual-clone/
│   ├── runtime.ts          # Preview constants and helpers
│   └── mirrored/           # Visual-only component clones
│       └── app/
│           └── components/
│               └── JoinedGames.tsx
├── app/
│   └── index.tsx           # Patched to render preview root
└── package.json            # Copied from source
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT

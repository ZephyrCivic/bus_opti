/**
 * src/App.tsx
 * Tabs 切替で Import / Explorer を行き来できるようにする（暫定）。
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import AppShell from './components/layout/AppShell';
import { Toaster } from './components/ui/sonner';
import ImportView from './features/import/ImportView';
import ExplorerView from './features/explorer/ExplorerView';
import { GtfsImportProvider } from './services/import/GtfsImportProvider';

export default function App(): JSX.Element {
  return (
    <GtfsImportProvider>
      <AppShell>
        <Tabs defaultValue="import" className="space-y-4">
          <TabsList>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="explorer">Explorer</TabsTrigger>
          </TabsList>
          <TabsContent value="import">
            <ImportView />
          </TabsContent>
          <TabsContent value="explorer">
            <ExplorerView />
          </TabsContent>
        </Tabs>
      </AppShell>
      <Toaster position="top-right" richColors closeButton />
    </GtfsImportProvider>
  );
}

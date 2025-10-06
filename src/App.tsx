/**
 * src/App.tsx
 * TabsでImport/Explorer/Blocks/Dutiesを切り替えられるように構成する。
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import AppShell from './components/layout/AppShell';
import { Toaster } from './components/ui/sonner';
import ImportView from './features/import/ImportView';
import ExplorerView from './features/explorer/ExplorerView';
import BlocksView from './features/blocks/BlocksView';
import DutiesView from './features/duties/DutiesView';
import { GtfsImportProvider } from './services/import/GtfsImportProvider';

export default function App(): JSX.Element {
  return (
    <GtfsImportProvider>
      <AppShell>
        <Tabs defaultValue="import" className="space-y-4">
          <TabsList>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="explorer">Explorer</TabsTrigger>
            <TabsTrigger value="blocks">Blocks</TabsTrigger>
            <TabsTrigger value="duties">Duties</TabsTrigger>
          </TabsList>
          <TabsContent value="import">
            <ImportView />
          </TabsContent>
          <TabsContent value="explorer">
            <ExplorerView />
          </TabsContent>
          <TabsContent value="blocks">
            <BlocksView />
          </TabsContent>
          <TabsContent value="duties">
            <DutiesView />
          </TabsContent>
        </Tabs>
      </AppShell>
      <Toaster position="top-right" richColors closeButton />
    </GtfsImportProvider>
  );
}

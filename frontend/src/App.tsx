import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { getDraftPageCopy, type DraftVariant } from './config/draftPages'
import { DraftEntryPage } from './pages/DraftEntryPage'
import { DraftExcelImportPage } from './pages/DraftExcelImportPage'
import { DraftPdfImportPage } from './pages/DraftPdfImportPage'
import { DraftListPage } from './pages/DraftListPage'
import { BalancesPage } from './pages/BalancesPage'
import { CurrentStockPage } from './pages/CurrentStockPage'
import { GrgiPage } from './pages/GrgiPage'
import { LotTracePage } from './pages/LotTracePage'
import { BomsPage } from './pages/masters/BomsPage'
import { ItemTypesPage } from './pages/masters/ItemTypesPage'
import { ItemsPage } from './pages/masters/ItemsPage'
import { MoveTypesPage } from './pages/masters/MoveTypesPage'
import { LocationsPage } from './pages/masters/LocationsPage'
import { SuppliersPage } from './pages/masters/SuppliersPage'
import { ApiDocsPage } from './pages/ApiDocsPage'

function DraftDetailRedirect({ variant }: { variant: DraftVariant }) {
  const { id } = useParams()
  const copy = getDraftPageCopy(variant)
  const numId = Number(id)
  if (!id || Number.isNaN(numId)) {
    return <Navigate to={copy.listPath} replace />
  }
  return <Navigate to={copy.listPathWithId(numId)} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DraftListPage variant="receipt" />} />
          <Route path="drafts/new" element={<DraftEntryPage variant="receipt" />} />
          <Route path="drafts/import" element={<DraftExcelImportPage variant="receipt" />} />
          <Route path="drafts/import-pdf" element={<DraftPdfImportPage />} />
          <Route path="drafts/:id" element={<DraftDetailRedirect variant="receipt" />} />
          <Route path="delivery" element={<DraftListPage variant="delivery" />} />
          <Route path="delivery/new" element={<DraftEntryPage variant="delivery" />} />
          <Route path="delivery/import" element={<DraftExcelImportPage variant="delivery" />} />
          <Route path="delivery/:id" element={<DraftDetailRedirect variant="delivery" />} />
          <Route path="inventory/currents" element={<CurrentStockPage />} />
          <Route path="inventory/grgi" element={<GrgiPage />} />
          <Route path="inventory/balances" element={<BalancesPage />} />
          <Route path="trace" element={<LotTracePage />} />
          <Route path="masters/itemtyps" element={<ItemTypesPage />} />
          <Route path="masters/suppliers" element={<SuppliersPage />} />
          <Route path="masters/movetyps" element={<MoveTypesPage />} />
          <Route path="masters/locations" element={<LocationsPage />} />
          <Route path="masters/items" element={<ItemsPage />} />
          <Route path="masters/boms" element={<BomsPage />} />
          <Route path="api-docs" element={<ApiDocsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

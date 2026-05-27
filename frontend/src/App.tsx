import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DraftCreatePage } from './pages/DraftCreatePage'
import { DraftExcelImportPage } from './pages/DraftExcelImportPage'
import { DraftPdfImportPage } from './pages/DraftPdfImportPage'
import { DraftDetailPage } from './pages/DraftDetailPage'
import { DraftListPage } from './pages/DraftListPage'
import { BalancesPage } from './pages/BalancesPage'
import { CurrentStockPage } from './pages/CurrentStockPage'
import { GrgiPage } from './pages/GrgiPage'
import { LotTracePage } from './pages/LotTracePage'
import { BomsPage } from './pages/masters/BomsPage'
import { ItemTypesPage } from './pages/masters/ItemTypesPage'
import { ItemsPage } from './pages/masters/ItemsPage'
import { MoveTypesPage } from './pages/masters/MoveTypesPage'
import { SuppliersPage } from './pages/masters/SuppliersPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DraftListPage />} />
          <Route path="drafts/new" element={<DraftCreatePage />} />
          <Route path="drafts/import" element={<DraftExcelImportPage />} />
          <Route path="drafts/import-pdf" element={<DraftPdfImportPage />} />
          <Route path="drafts/:id" element={<DraftDetailPage />} />
          <Route path="inventory/currents" element={<CurrentStockPage />} />
          <Route path="inventory/grgi" element={<GrgiPage />} />
          <Route path="inventory/balances" element={<BalancesPage />} />
          <Route path="trace" element={<LotTracePage />} />
          <Route path="masters/itemtyps" element={<ItemTypesPage />} />
          <Route path="masters/suppliers" element={<SuppliersPage />} />
          <Route path="masters/movetyps" element={<MoveTypesPage />} />
          <Route path="masters/items" element={<ItemsPage />} />
          <Route path="masters/boms" element={<BomsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

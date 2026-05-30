import { Navigate, useParams, type RouteObject } from 'react-router-dom'
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
import { ItemProcessesPage } from './pages/masters/ItemProcessesPage'
import { ItemTypesPage } from './pages/masters/ItemTypesPage'
import { ItemsPage } from './pages/masters/ItemsPage'
import { MoveTypesPage } from './pages/masters/MoveTypesPage'
import { LocationsPage } from './pages/masters/LocationsPage'
import { CustomersPage } from './pages/masters/CustomersPage'
import { SuppliersPage } from './pages/masters/SuppliersPage'
import { ApiDocsPage } from './pages/ApiDocsPage'
import { ProductionOrdersPage } from './pages/ProductionOrdersPage'
import { ProductionEntryPage } from './pages/ProductionEntryPage'
import { ProductionExcelImportPage } from './pages/ProductionExcelImportPage'

function DraftDetailRedirect({ variant }: { variant: DraftVariant }) {
  const { id } = useParams()
  const copy = getDraftPageCopy(variant)
  const numId = Number(id)
  if (!id || Number.isNaN(numId)) {
    return <Navigate to={copy.listPath} replace />
  }
  return <Navigate to={copy.listPathWithId(numId)} replace />
}

export const appRouteObjects: RouteObject[] = [
  { index: true, element: <DraftListPage variant="receipt" /> },
  { path: 'drafts/new', element: <DraftEntryPage variant="receipt" /> },
  { path: 'drafts/import', element: <DraftExcelImportPage variant="receipt" /> },
  { path: 'drafts/import-pdf', element: <DraftPdfImportPage /> },
  { path: 'drafts/:id', element: <DraftDetailRedirect variant="receipt" /> },
  { path: 'delivery', element: <DraftListPage variant="delivery" /> },
  { path: 'delivery/new', element: <DraftEntryPage variant="delivery" /> },
  { path: 'delivery/import', element: <DraftExcelImportPage variant="delivery" /> },
  { path: 'delivery/:id', element: <DraftDetailRedirect variant="delivery" /> },
  { path: 'production/orders', element: <ProductionOrdersPage /> },
  { path: 'production/new', element: <ProductionEntryPage /> },
  { path: 'production/import', element: <ProductionExcelImportPage /> },
  { path: 'inventory/currents', element: <CurrentStockPage /> },
  { path: 'inventory/grgi', element: <GrgiPage /> },
  { path: 'inventory/balances', element: <BalancesPage /> },
  { path: 'trace', element: <LotTracePage /> },
  { path: 'masters/itemtyps', element: <ItemTypesPage /> },
  { path: 'masters/suppliers', element: <SuppliersPage /> },
  { path: 'masters/customers', element: <CustomersPage /> },
  { path: 'masters/movetyps', element: <MoveTypesPage /> },
  { path: 'masters/locations', element: <LocationsPage /> },
  { path: 'masters/items', element: <ItemsPage /> },
  { path: 'masters/boms', element: <BomsPage /> },
  { path: 'masters/item-processes', element: <ItemProcessesPage /> },
  { path: 'api-docs', element: <ApiDocsPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]

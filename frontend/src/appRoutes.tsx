import { useParams, type RouteObject } from 'react-router-dom'
import { ActiveTabNavigate } from './context/AppNavigateContext'
import { getDraftPageCopy, type DraftVariant } from './config/draftPages'
import { DraftEntryPage } from './pages/DraftEntryPage'
import { DraftPdfImportPage } from './pages/DraftPdfImportPage'
import { DraftListPage } from './pages/DraftListPage'
import { ReceiptListPage } from './pages/ReceiptListPage'
import { BalancesPage } from './pages/BalancesPage'
import { CurrentStockPage } from './pages/CurrentStockPage'
import { GrgiPage } from './pages/GrgiPage'
import { LotTracePage } from './pages/LotTracePage'
import { ItemProcessesPage } from './pages/masters/ItemProcessesPage'
import { ItemTypesPage } from './pages/masters/ItemTypesPage'
import { ItemsPage } from './pages/masters/ItemsPage'
import { MoveTypesPage } from './pages/masters/MoveTypesPage'
import { LocationTypesPage } from './pages/masters/LocationTypesPage'
import { LocationsPage } from './pages/masters/LocationsPage'
import { CustomersPage } from './pages/masters/CustomersPage'
import { SuppliersPage } from './pages/masters/SuppliersPage'
import { CompaniesPage } from './pages/masters/CompaniesPage'
import { UsersPage } from './pages/masters/UsersPage'
import { ApiDocsPage } from './pages/ApiDocsPage'
import { ProductionOrdersPage } from './pages/ProductionOrdersPage'
import { ProductionEntryPage } from './pages/ProductionEntryPage'
import { HomePage } from './pages/HomePage'
function DraftDetailRedirect({ variant }: { variant: DraftVariant }) {
  const { id } = useParams()
  const copy = getDraftPageCopy(variant)
  const numId = Number(id)
  if (!id || Number.isNaN(numId)) {
    return <ActiveTabNavigate to={copy.listPath} replace />
  }
  return <ActiveTabNavigate to={copy.listPathWithId(numId)} replace />
}

export const appRouteObjects: RouteObject[] = [
  { path: 'home', element: <HomePage /> },
  { index: true, element: <ReceiptListPage /> },
  { path: 'drafts/new', element: <ActiveTabNavigate to="/" replace /> },
  { path: 'drafts/import-pdf', element: <DraftPdfImportPage /> },
  { path: 'drafts/:id', element: <DraftDetailRedirect variant="receipt" /> },
  { path: 'delivery', element: <DraftListPage variant="delivery" /> },
  { path: 'delivery/new', element: <DraftEntryPage variant="delivery" /> },
  { path: 'delivery/:id', element: <DraftDetailRedirect variant="delivery" /> },
  { path: 'production/orders', element: <ProductionOrdersPage /> },
  { path: 'production/new', element: <ProductionEntryPage /> },
  { path: 'inventory/currents', element: <CurrentStockPage /> },
  { path: 'inventory/grgi', element: <GrgiPage /> },
  { path: 'inventory/balances', element: <BalancesPage /> },
  { path: 'trace', element: <LotTracePage /> },
  { path: 'masters/itemtyps', element: <ItemTypesPage /> },
  { path: 'masters/suppliers', element: <SuppliersPage /> },
  { path: 'masters/customers', element: <CustomersPage /> },
  { path: 'masters/companies', element: <CompaniesPage /> },
  { path: 'masters/users', element: <UsersPage /> },
  { path: 'masters/movetyps', element: <MoveTypesPage /> },
  { path: 'masters/locationtyps', element: <LocationTypesPage /> },
  { path: 'masters/locations', element: <LocationsPage /> },
  { path: 'masters/items', element: <ItemsPage /> },
  { path: 'masters/boms', element: <ActiveTabNavigate to="/masters/items" replace /> },
  { path: 'masters/item-processes', element: <ItemProcessesPage /> },
  { path: 'api-docs', element: <ApiDocsPage /> },
  { path: '*', element: <ActiveTabNavigate to="/home" replace /> },
]

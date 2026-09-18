import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AnimalesPage, LotesPage, RazasPage } from './pages/GanaderiaPages'
import {
  CategoriasProductosPage,
  MovimientosPage,
  ProductosPage,
  UnidadesMedidaPage,
} from './pages/InventarioPages'
import {
  ComprasAnimalesPage,
  ComprasInsumosPage,
  ProveedoresPage,
} from './pages/ComprasPages'
import { ConsumosPage, PlanesPage, TratamientosPage } from './pages/ProduccionPages'
import { CategoriasGastosPage, GastosPage } from './pages/FinanzasPages'
import { VentasPage } from './pages/VentasPage'
import { LoteDetallePage } from './pages/LoteDetallePage'
import { AuditoriaPage } from './pages/AuditoriaPage'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/animales" element={<AnimalesPage />} />
        <Route path="/lotes" element={<LotesPage />} />
        <Route path="/lotes/:id" element={<LoteDetallePage />} />
        <Route path="/razas" element={<RazasPage />} />

        <Route path="/productos" element={<ProductosPage />} />
        <Route path="/movimientos" element={<MovimientosPage />} />
        <Route path="/categorias-productos" element={<CategoriasProductosPage />} />
        <Route path="/unidades-medida" element={<UnidadesMedidaPage />} />

        <Route path="/compras-insumos" element={<ComprasInsumosPage />} />
        <Route path="/compras-animales" element={<ComprasAnimalesPage />} />
        <Route path="/proveedores" element={<ProveedoresPage />} />

        <Route path="/consumos" element={<ConsumosPage />} />
        <Route path="/planes" element={<PlanesPage />} />
        <Route path="/tratamientos" element={<TratamientosPage />} />

        <Route path="/ventas" element={<VentasPage />} />

        <Route path="/gastos" element={<GastosPage />} />
        <Route path="/categorias-gastos" element={<CategoriasGastosPage />} />

        <Route path="/auditoria" element={<AuditoriaPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
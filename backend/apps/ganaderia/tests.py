from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.inventario.models import CategoriaProducto, UnidadMedida, Producto, PresentacionProducto
from apps.inventario.services import InventarioService
from apps.ganaderia.models import Raza, Lote, Animal
from apps.ganaderia.services import marcar_fallecido, dividir_lote
from apps.compra_animales.services import registrar_compra
from apps.compra_animales.models import Proveedor
from apps.compra_insumos.services import crear_compra, confirmar_compra
from apps.consumos.services import registrar_consumo, generar_consumo_desde_plan
from apps.alimentacion.models import PlanConsumo, DetallePlanConsumo, AsignacionPlanLote
from apps.sanidad.services import registrar_tratamiento
from apps.gastos.models import CategoriaGasto, Gasto
from apps.ventas.services import crear_venta, confirmar_venta
from apps.ventas.models import DetalleVenta
from apps.dashboard.services import resumen_dashboard, costos_y_rentabilidad_lote
from apps.auditoria.models import RegistroAuditoria


class BaseDatosMixin:
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user('admin_test', password='test12345', is_staff=True, is_superuser=True)
        cls.operador = User.objects.create_user('oper_test', password='test12345')

        cls.kg = UnidadMedida.objects.create(codigo='KG', nombre='Kilogramo', tipo='Peso', decimales=3)
        cls.un = UnidadMedida.objects.create(codigo='UN', nombre='Unidad', tipo='Unidad', decimales=0)
        cls.cat_alimento = CategoriaProducto.objects.create(nombre='Alimento')
        cls.producto = Producto.objects.create(
            nombre='Sustituto lácteo', categoria=cls.cat_alimento, unidad_base=cls.kg, stock_minimo=Decimal('10'))
        cls.presentacion = PresentacionProducto.objects.create(
            producto=cls.producto, nombre='Saco 25 kg', cantidad_base=Decimal('25'), unidad_base=cls.kg)
        cls.medicamento = Producto.objects.create(
            nombre='Azobetril', categoria=cls.cat_alimento, unidad_base=cls.un)
        cls.raza = Raza.objects.create(nombre='Holando')
        cls.cat_gasto = CategoriaGasto.objects.create(nombre='Sanidad')
        cls.proveedor = Proveedor.objects.create(nombre='Proveedor Test')


class InventarioServiceTests(BaseDatosMixin, TestCase):
    def test_pmp_entrada_y_salida(self):
        InventarioService.entrada(self.producto.pk, 100, 1000, self.admin)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, Decimal('100'))
        self.assertEqual(self.producto.costo_promedio, Decimal('1000.00'))

        InventarioService.entrada(self.producto.pk, 100, 2000, self.admin)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, Decimal('200'))
        self.assertEqual(self.producto.costo_promedio, Decimal('1500.00'))

        movimiento = InventarioService.salida(self.producto.pk, 50, self.admin)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, Decimal('150'))
        self.assertEqual(movimiento.costo_total, Decimal('75000.00'))

    def test_no_permite_stock_negativo(self):
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            InventarioService.salida(self.producto.pk, 5, self.admin)


class CompraInsumosTests(BaseDatosMixin, TestCase):
    def test_confirmar_compra_actualiza_stock_y_pmp(self):
        compra = crear_compra({
            'proveedor': self.proveedor,
            'fecha': date(2026, 9, 1),
            'detalles': [{
                'producto': self.producto,
                'presentacion': self.presentacion,
                'cantidad': Decimal('2'),
                'precio_unitario': Decimal('1200'),
            }],
        }, self.admin)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, Decimal('0'))

        confirmar_compra(compra, self.admin)
        compra.refresh_from_db()
        self.assertEqual(compra.estado, 'CONFIRMADA')
        self.assertEqual(compra.total, Decimal('60000.00'))

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, Decimal('50'))
        self.assertEqual(self.producto.costo_promedio, Decimal('1200.00'))


class CompraAnimalesTests(BaseDatosMixin, TestCase):
    def _animal(self, diio):
        return {
            'diio': diio, 'raza': self.raza, 'sexo': 'M',
            'edad_aproximada_dias': 7, 'fecha_adquisicion': date(2026, 9, 1),
            'precio_adquisicion': Decimal('100000'),
        }

    def test_compra_grupal_genera_lote(self):
        compra = registrar_compra({
            'fecha': date(2026, 9, 1),
            'lote_nuevo': {'codigo': 'L-2026-001', 'fecha_ingreso': date(2026, 9, 1)},
            'animales': [self._animal('A001'), self._animal('A002')],
        }, self.admin)
        lote = Lote.objects.get(codigo='L-2026-001')
        self.assertEqual(lote.cantidad_original, 2)
        self.assertEqual(lote.cantidad_actual, 2)
        self.assertEqual(compra.total, Decimal('200000.00'))
        self.assertEqual(lote.animales.count(), 2)

    def test_incorporacion_excepcional_conserva_costo(self):
        registrar_compra({
            'fecha': date(2026, 9, 1),
            'lote_nuevo': {'codigo': 'L-2026-002', 'fecha_ingreso': date(2026, 9, 1)},
            'animales': [self._animal('B001')],
        }, self.admin)
        lote = Lote.objects.get(codigo='L-2026-002')
        registrar_compra({
            'fecha': date(2026, 9, 5),
            'lote': lote,
            'animales': [{**self._animal('B002'), 'precio_adquisicion': Decimal('150000')}],
        }, self.admin)
        lote.refresh_from_db()
        self.assertEqual(lote.cantidad_actual, 2)
        self.assertEqual(lote.animales.get(diio='B002').precio_adquisicion, Decimal('150000'))

    def test_muerte_y_division(self):
        registrar_compra({
            'fecha': date(2026, 9, 1),
            'lote_nuevo': {'codigo': 'L-2026-003', 'fecha_ingreso': date(2026, 9, 1)},
            'animales': [self._animal('C001'), self._animal('C002'), self._animal('C003')],
        }, self.admin)
        lote = Lote.objects.get(codigo='L-2026-003')

        marcar_fallecido(lote.animales.get(diio='C001'), self.admin)
        lote.refresh_from_db()
        self.assertEqual(lote.cantidad_actual, 2)

        derivado = dividir_lote(lote, 'L-2026-003-A', [lote.animales.get(diio='C002').pk], self.admin, date(2026, 9, 10))
        lote.refresh_from_db()
        self.assertEqual(derivado.cantidad_actual, 1)
        self.assertEqual(derivado.lote_origen, lote)
        self.assertEqual(lote.cantidad_actual, 1)


class ConsumosTests(BaseDatosMixin, TestCase):
    def _lote(self):
        registrar_compra({
            'fecha': date(2026, 9, 1),
            'lote_nuevo': {'codigo': 'LC-1', 'fecha_ingreso': date(2026, 9, 1)},
            'animales': [{
                'diio': 'D001', 'raza': self.raza, 'sexo': 'M',
                'edad_aproximada_dias': 7, 'fecha_adquisicion': date(2026, 9, 1),
                'precio_adquisicion': Decimal('100000'),
            }],
        }, self.admin)
        return Lote.objects.get(codigo='LC-1')

    def test_consumo_descuenta_stock(self):
        InventarioService.entrada(self.producto.pk, 100, 1000, self.admin)
        lote = self._lote()
        consumo = registrar_consumo({
            'fecha': date(2026, 9, 2), 'lote': lote, 'origen': 'REAL',
            'detalles': [{'producto': self.producto, 'cantidad': Decimal('4'), 'unidad': self.kg}],
        }, self.operador)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, Decimal('96'))
        self.assertEqual(consumo.detalles.first().costo_total, Decimal('4000.00'))

    def test_generar_consumo_desde_plan(self):
        InventarioService.entrada(self.producto.pk, 100, 1000, self.admin)
        lote = self._lote()
        plan = PlanConsumo.objects.create(nombre='Plan 4 kg')
        DetallePlanConsumo.objects.create(
            plan=plan, producto=self.producto, cantidad_diaria=Decimal('4'), unidad=self.kg)
        asignacion = AsignacionPlanLote.objects.create(
            lote=lote, plan=plan, fecha_inicio=date(2026, 9, 2))

        consumo = generar_consumo_desde_plan(asignacion, self.operador, date(2026, 9, 2))
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock_actual, Decimal('96'))
        self.assertEqual(consumo.origen, 'PLAN')


class SanidadTests(BaseDatosMixin, TestCase):
    def test_tratamiento_descuenta_inventario(self):
        InventarioService.entrada(self.medicamento.pk, 5, 2000, self.admin)
        lote = Lote.objects.create(
            codigo='LS-1', fecha_ingreso=date(2026, 9, 1), cantidad_original=1, cantidad_actual=1)
        animal = Animal.objects.create(
            diio='S001', lote=lote, raza=self.raza, sexo='M', edad_aproximada_dias=7,
            fecha_adquisicion=date(2026, 9, 1), precio_adquisicion=Decimal('100000'))

        tratamiento = registrar_tratamiento({
            'animal': animal, 'producto': self.medicamento, 'fecha': date(2026, 9, 3),
            'cantidad': Decimal('1'), 'motivo': 'Diarrea',
        }, self.admin)
        self.medicamento.refresh_from_db()
        self.assertEqual(self.medicamento.stock_actual, Decimal('4'))
        self.assertEqual(tratamiento.costo_total, Decimal('2000.00'))


class VentasTests(BaseDatosMixin, TestCase):
    def test_confirmar_venta_cierra_lote_y_calcula_utilidad(self):
        registrar_compra({
            'fecha': date(2026, 9, 1),
            'lote_nuevo': {'codigo': 'LV-1', 'fecha_ingreso': date(2026, 9, 1)},
            'animales': [
                {'diio': 'V001', 'raza': self.raza, 'sexo': 'M', 'edad_aproximada_dias': 7,
                 'fecha_adquisicion': date(2026, 9, 1), 'precio_adquisicion': Decimal('100000')},
                {'diio': 'V002', 'raza': self.raza, 'sexo': 'M', 'edad_aproximada_dias': 7,
                 'fecha_adquisicion': date(2026, 9, 1), 'precio_adquisicion': Decimal('100000')},
            ],
        }, self.admin)
        lote = Lote.objects.get(codigo='LV-1')
        Gasto.objects.create(
            categoria=self.cat_gasto, lote=lote, fecha=date(2026, 9, 2),
            nombre='Tratamiento corral', monto=Decimal('10000'))

        venta = crear_venta({
            'fecha': date(2026, 10, 1), 'comprador': 'Feria',
            'total_venta': Decimal('300000'),
            'detalles': [{'lote': lote, 'cantidad_animales': 2}],
        }, self.operador)

        inventario_pre = resumen_dashboard()['valor_inventario']
        confirmar_venta(venta, self.operador)

        lote.refresh_from_db()
        self.assertEqual(lote.estado, 'CERRADO')
        self.assertEqual(lote.cantidad_actual, 0)
        self.assertEqual(lote.animales.filter(estado='VENDIDO').count(), 2)

        detalle = DetalleVenta.objects.get(venta=venta, lote=lote)
        self.assertEqual(detalle.costo_reconocido, Decimal('210000.00'))
        self.assertEqual(detalle.utilidad, Decimal('90000.00'))

        indicadores = costos_y_rentabilidad_lote(lote)
        self.assertEqual(indicadores['utilidad'], 90000.0)
        self.assertEqual(indicadores['costo']['adquisicion'], 200000.0)


class DashboardYAuditoriaTests(BaseDatosMixin, TestCase):
    def test_resumen_dashboard(self):
        resumen = resumen_dashboard()
        self.assertIn('animales_activos', resumen)
        self.assertIn('valor_inventario', resumen)

    def test_auditoria_registra_operaciones(self):
        registrar_compra({
            'fecha': date(2026, 9, 1),
            'lote_nuevo': {'codigo': 'LA-1', 'fecha_ingreso': date(2026, 9, 1)},
            'animales': [{'diio': 'AUD1', 'raza': self.raza, 'sexo': 'M',
                          'edad_aproximada_dias': 7, 'fecha_adquisicion': date(2026, 9, 1),
                          'precio_adquisicion': Decimal('100000')}],
        }, self.admin)
        self.assertTrue(RegistroAuditoria.objects.filter(modelo='CompraAnimal').exists())


class AuthAPITests(BaseDatosMixin, TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_endpoint_requiere_autenticacion(self):
        respuesta = self.client.get('/api/dashboard/resumen/')
        self.assertEqual(respuesta.status_code, 401)

    def test_token_y_me(self):
        respuesta = self.client.post('/api/auth/token/', {
            'username': 'admin_test', 'password': 'test12345'}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertIn('access', respuesta.data)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {respuesta.data['access']}")
        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.status_code, 200)
        self.assertTrue(me.data['es_administrador'])

    def test_operador_no_puede_crear_productos(self):
        self.client.force_authenticate(user=self.operador)
        respuesta = self.client.post('/api/inventario/productos/', {
            'nombre': 'Nuevo', 'categoria': self.cat_alimento.pk,
            'unidad_base': self.kg.pk}, format='json')
        self.assertEqual(respuesta.status_code, 403)
import os

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group

from config.permissions import GRUPO_ADMIN, GRUPO_OPERADOR
from apps.ganaderia.models import Raza
from apps.inventario.models import (
    CategoriaProducto, UnidadMedida, Producto, PresentacionProducto, ConversionProducto,
)
from apps.gastos.models import CategoriaGasto


class Command(BaseCommand):
    help = 'Crea roles, usuarios y datos maestros mínimos para usar el sistema.'

    def handle(self, *args, **options):
        self._grupos_y_usuarios()
        unidades = self._unidades()
        categorias = self._categorias()
        self._productos(unidades, categorias)
        self._razas()
        self._categorias_gasto()
        self.stdout.write(self.style.SUCCESS('Datos semilla cargados correctamente.'))

    def _grupos_y_usuarios(self):
        admin_group, _ = Group.objects.get_or_create(name=GRUPO_ADMIN)
        operador_group, _ = Group.objects.get_or_create(name=GRUPO_OPERADOR)

        admin_user = os.getenv('SEED_ADMIN_USER', 'admin')
        admin_pass = os.getenv('SEED_ADMIN_PASSWORD', 'admin12345')
        user, creado = User.objects.get_or_create(
            username=admin_user,
            defaults={'email': 'admin@sgic.local', 'is_staff': True, 'is_superuser': True},
        )
        if creado:
            user.set_password(admin_pass)
            user.save()
            self.stdout.write(self.style.WARNING(
                f'Usuario administrador creado: {admin_user} / {admin_pass}'))
        user.groups.add(admin_group)

        op_user = os.getenv('SEED_OPERADOR_USER', 'operador')
        op_pass = os.getenv('SEED_OPERADOR_PASSWORD', 'operador123')
        user_op, creado_op = User.objects.get_or_create(
            username=op_user, defaults={'email': 'operador@sgic.local'})
        if creado_op:
            user_op.set_password(op_pass)
            user_op.save()
            self.stdout.write(self.style.WARNING(
                f'Usuario operador creado: {op_user} / {op_pass}'))
        user_op.groups.add(operador_group)

    def _unidades(self):
        datos = [
            ('KG', 'Kilogramo', 'Peso', 3),
            ('UN', 'Unidad', 'Unidad', 0),
            ('BOLO', 'Bolo', 'Unidad', 0),
            ('L', 'Litro', 'Volumen', 2),
        ]
        resultado = {}
        for codigo, nombre, tipo, decimales in datos:
            obj, _ = UnidadMedida.objects.get_or_create(
                codigo=codigo,
                defaults={'nombre': nombre, 'tipo': tipo, 'decimales': decimales},
            )
            resultado[codigo] = obj
        return resultado

    def _categorias(self):
        nombres = ['Alimento', 'Forraje', 'Medicamento', 'Otros']
        resultado = {}
        for nombre in nombres:
            obj, _ = CategoriaProducto.objects.get_or_create(nombre=nombre)
            resultado[nombre] = obj
        return resultado

    def _productos(self, unidades, categorias):
        kg = unidades['KG']
        un = unidades['UN']
        bolo = unidades['BOLO']

        definiciones = [
            {
                'nombre': 'Sustituto lácteo', 'categoria': 'Alimento', 'unidad': kg,
                'stock_minimo': 25,
                'presentacion': ('Saco 25 kg', 25),
                'conversion': (0.125, kg, 1, unidades['L']),
            },
            {
                'nombre': 'Concentrado inicial', 'categoria': 'Alimento', 'unidad': kg,
                'stock_minimo': 50, 'presentacion': ('Saco 25 kg', 25),
            },
            {
                'nombre': 'Concentrado crecimiento', 'categoria': 'Alimento', 'unidad': kg,
                'stock_minimo': 50, 'presentacion': ('Saco 25 kg', 25),
            },
            {
                'nombre': 'Silo', 'categoria': 'Forraje', 'unidad': bolo,
                'stock_minimo': 5, 'presentacion': ('Bolo', 1),
            },
            {
                'nombre': 'Heno/fardo', 'categoria': 'Forraje', 'unidad': un,
                'stock_minimo': 10, 'presentacion': ('Fardo', 1),
            },
            {
                'nombre': 'Paja', 'categoria': 'Forraje', 'unidad': un,
                'stock_minimo': 5, 'presentacion': ('Fardo', 1),
            },
            {
                'nombre': 'Azobetril', 'categoria': 'Medicamento', 'unidad': un,
                'stock_minimo': 2, 'presentacion': ('Frasco', 1),
            },
            {
                'nombre': 'Licuamicina', 'categoria': 'Medicamento', 'unidad': un,
                'stock_minimo': 2, 'presentacion': ('Frasco', 1),
            },
        ]

        for d in definiciones:
            producto, _ = Producto.objects.get_or_create(
                nombre=d['nombre'],
                defaults={
                    'categoria': categorias[d['categoria']],
                    'unidad_base': d['unidad'],
                    'stock_minimo': d['stock_minimo'],
                },
            )
            if d.get('presentacion'):
                nombre_pres, cantidad = d['presentacion']
                PresentacionProducto.objects.get_or_create(
                    producto=producto, nombre=nombre_pres,
                    defaults={'cantidad_base': cantidad, 'unidad_base': d['unidad']},
                )
            if d.get('conversion'):
                co, uo, cd, ud = d['conversion']
                ConversionProducto.objects.get_or_create(
                    producto=producto, cantidad_origen=co, unidad_origen=uo,
                    cantidad_destino=cd, unidad_destino=ud,
                )

    def _razas(self):
        for nombre in ['Holando', 'Hereford', 'Angus', 'Overo Colorado', 'Cruzado']:
            Raza.objects.get_or_create(nombre=nombre)

    def _categorias_gasto(self):
        for nombre in ['Alimentación', 'Sanidad', 'Combustibles', 'Servicios básicos',
                       'Mantención', 'Mano de obra', 'Otros']:
            CategoriaGasto.objects.get_or_create(nombre=nombre)
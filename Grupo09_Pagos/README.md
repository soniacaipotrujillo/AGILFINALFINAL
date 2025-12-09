# Sistema de gestión de pagos

Este proyecto implementa un flujo web para gestionar deudas y pagos mensuales. El frontend usa HTML, CSS y JavaScript nativos, el backend se desarrolla en Node.js y los datos persisten en PostgreSQL.

## Objetivo funcional
El sistema debe permitir a un usuario visualizar y gestionar sus deudas de forma clara cada mes:
1. Notificar cuando una deuda vence el día actual, sin que el usuario tenga que ingresar manualmente al sistema.
2. Mostrar por defecto solo las deudas del mes actual más las deudas pendientes de meses anteriores.
3. Destacar visualmente las deudas: amarillo para las que vencen esta semana y siguen pendientes; rojo para las vencidas no pagadas.
4. Permitir el pago de cualquier deuda en el momento que el usuario elija.

## Arquitectura
- **Frontend (HTML/CSS/JS):** Interfaz web ligera que consulta la API para obtener las deudas, aplica las reglas de resaltado y expone acciones de pago.
- **Backend (Node.js):** API REST que expone endpoints para consultar deudas, actualizar estados de pago y enviar notificaciones de vencimiento.
- **Base de datos (PostgreSQL):** Almacena deudas, fechas de vencimiento, estados de pago y registros de usuario necesarios para las notificaciones.

### Flujo de integración
1. El frontend solicita a la API las deudas filtradas por mes y estado.
2. El backend consulta PostgreSQL, aplica las reglas de negocio (vencimientos del día y de la semana) y devuelve la información ya categorizada para el resaltado.
3. Cuando el usuario paga una deuda, el frontend envía la acción al backend, que actualiza el estado en la base de datos y responde con el nuevo estado de la deuda.
4. Un proceso programado en Node.js puede enviar notificaciones diarias para las deudas que vencen en el día.

## Conexión a PostgreSQL
Parámetros de referencia para la conexión de desarrollo:
- **Servidor:** `localhost`
- **Tipo de autenticación:** Contraseña
- **Usuario:** `postgres`
- **Contraseña:** (definir en entorno local)
- **Base de datos:** `postgres`
- **Nombre de conexión:** `Grupo09_Agil_Developer`
- **Grupo de servidores:** `Servidores`

## Recursos
- Historia de usuario: [Documento colaborativo](https://docs.google.com/document/d/1_DulyZ7aHq9F_kUdg4m_Hee7Zefu3PVZVzbflqofOhI/edit?usp=sharing)

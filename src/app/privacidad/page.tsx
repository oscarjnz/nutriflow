import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politica de privacidad',
};

const ULTIMA_ACTUALIZACION = '4 de septiembre de 2026';
const CORREO_CONTACTO = 'oscartronico1420@gmail.com';

export default function PrivacidadPage() {
  return (
    <main className="text-foreground mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold">Politica de privacidad de NutriFlow</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Ultima actualizacion: {ULTIMA_ACTUALIZACION}
      </p>

      <div className="mt-10 space-y-8 leading-relaxed">
        <section>
          <p>
            NutriFlow es una aplicacion personal de registro nutricional, seguimiento de peso y
            ayuno intermitente, desarrollada y operada por Oscar Jimenez. Esta pagina explica que
            datos recopila la aplicacion (tanto la version web como la version movil), para que se
            usan y como puedes pedir que se eliminen.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Datos que recopilamos</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Datos de cuenta:</strong> correo electronico y nombre, provistos por ti al
              registrarte o por tu cuenta de Google si eliges iniciar sesion con ella.
            </li>
            <li>
              <strong>Datos de salud y nutricion:</strong> peso y composicion corporal, alimentos y
              cantidades que registras, metas de calorias y macronutrientes, e historial de sesiones
              de ayuno.
            </li>
            <li>
              <strong>Datos de uso del catalogo de alimentos:</strong> las busquedas y codigos de
              barra que registras, para asociarlos a un alimento y calcular sus macronutrientes.
            </li>
          </ul>
          <p className="mt-3">
            La aplicacion movil pide permiso de camara unicamente para leer codigos de barra al
            registrar un alimento. No se guarda ninguna foto ni video: la camara solo se usa para
            decodificar el codigo en el momento.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Para que se usan estos datos</h2>
          <p className="mt-3">
            Unicamente para operar la aplicacion: calcular tus metas nutricionales, mostrar tu
            historial y progreso, y permitir el registro de comidas, peso y ayunos. NutriFlow no
            muestra publicidad, no vende datos a terceros ni los usa con fines de mercadeo.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Con quien se comparten los datos</h2>
          <p className="mt-3">
            NutriFlow usa los siguientes proveedores para operar, cada uno bajo su propia politica
            de privacidad:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Clerk:</strong> gestiona el inicio de sesion (correo/contrasena y Google).
            </li>
            <li>
              <strong>Supabase:</strong> almacena tus datos de cuenta, salud y nutricion en una base
              de datos con reglas de acceso que restringen cada registro a su propio dueno.
            </li>
            <li>
              <strong>Vercel:</strong> aloja el servidor que procesa la logica de la aplicacion.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Seguridad</h2>
          <p className="mt-3">
            El acceso a la base de datos esta protegido por reglas de seguridad a nivel de fila (Row
            Level Security), de forma que cada usuario solo puede leer y escribir sus propios datos.
            La comunicacion entre la aplicacion y los servidores viaja siempre cifrada (HTTPS).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Retencion y eliminacion de datos</h2>
          <p className="mt-3">
            Conservamos tus datos mientras tu cuenta este activa. Si quieres eliminar tu cuenta y
            todos los datos asociados (registros de comidas, peso, ayunos y datos de perfil),
            escribe a{' '}
            <a className="underline" href={`mailto:${CORREO_CONTACTO}`}>
              {CORREO_CONTACTO}
            </a>{' '}
            desde el correo con el que te registraste. Atenderemos la solicitud y confirmaremos por
            correo cuando el borrado se haya completado.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Menores de edad</h2>
          <p className="mt-3">
            NutriFlow no esta dirigida a menores de 13 anos y no recopila deliberadamente datos de
            personas menores de esa edad.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Cambios a esta politica</h2>
          <p className="mt-3">
            Si esta politica cambia, actualizaremos la fecha al inicio de esta pagina.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Contacto</h2>
          <p className="mt-3">
            Para preguntas sobre esta politica o sobre tus datos, escribe a{' '}
            <a className="underline" href={`mailto:${CORREO_CONTACTO}`}>
              {CORREO_CONTACTO}
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

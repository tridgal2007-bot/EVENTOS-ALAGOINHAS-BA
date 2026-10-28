# Eventos em Alagoinhas — projeto atualizado

Projeto separado em HTML, CSS e JavaScript, preservando a página principal, calendário, filtros, busca, detalhes do evento, login/cadastro, autenticação com Google, edição de perfil, painel administrativo, upload de imagens e gerenciamento de administradores.

## Arquivos

- `index.html` — página pública.
- `styles.css` — aparência da página pública e carrossel.
- `script.js` — eventos, busca, filtros, carrossel, calendário, autenticação e notificações.
- `admin.html` — painel de administração.
- `admin.css` — aparência do painel.
- `admin.js` — cadastro/remoção de eventos e gerenciamento de administradores.
- `tailwind-config.js` — configuração de cores e fontes do Tailwind CDN.
- `supabase-config.js` — configuração da conexão com o Supabase.
- `supabase-maintenance.sql` — coluna de término, conversão de data sem fuso quando necessária e agendamento de limpeza.
- `perfil.png` — avatar padrão local, usado se o usuário ainda não enviou uma foto.

## Instalação obrigatória

1. Abra `supabase-config.js` e preencha `SUPABASE_URL` com a URL do projeto e `SUPABASE_ANON_KEY` com a chave pública `anon`/publishable. **Nunca** use a chave `service_role` no navegador.
2. No painel do Supabase, abra o SQL Editor e execute `supabase-maintenance.sql`. Confira a mensagem de saída para confirmar se o `pg_cron` foi habilitado e se o agendamento foi criado. Se a extensão não estiver disponível, ative `pg_cron` em **Database → Extensions** e execute o arquivo novamente.
3. Mantenha o bucket de Storage `alagoinhas-images` existente e público para leitura, como o projeto anterior usava, com policies de upload adequadas. A mesma bucket é usada para fotos dos eventos e avatares.
4. Confirme as policies/RLS existentes das tabelas `events` e `admins`. A página pública precisa poder ler os eventos; somente usuários autorizados devem cadastrar/excluir eventos e gerenciar a tabela `admins`.
5. Para o botão de Google funcionar, mantenha o provedor Google habilitado em **Authentication → Providers** e configure a URL pública do site em **Authentication → URL Configuration**.
6. Publique todos os arquivos no mesmo diretório/site, preservando os nomes, inclusive `perfil.png`. Abra `index.html` por um servidor HTTP (por exemplo, Live Server), não por `file://`.

## Horário sem deslocamento

O painel usa `datetime-local` e transforma o valor para um instante ISO considerando o fuso fixo de Alagoinhas (`America/Bahia`), independentemente do fuso do computador do administrador. O SQL converte a coluna antiga `date` de `timestamp without time zone` para `timestamptz`, interpretando registros antigos sem fuso como horário local de Alagoinhas. A gravação e a apresentação usam o fuso `America/Bahia`, para que o horário de Alagoinhas continue igual ao digitado mesmo se o administrador ou visitante estiver com outro fuso no aparelho. A coluna `end_date` guarda o término, e eventos finalizados ficam acinzentados e com a etiqueta **Já aconteceu** durante três dias.

Em registros antigos que já são `timestamptz`, o script não desloca valores existentes automaticamente, porque não há como distinguir com segurança os registros corretos dos que foram gravados com o fuso errado. Os novos cadastros seguem o fluxo corrigido.

## Limpeza e notificações

- A página oculta eventos depois de três dias do horário de término.
- O agendamento `pg_cron`, quando disponível e ativo, apaga os registros vencidos a cada 30 minutos sem depender de visitas ao site.
- O botão **Configurações → Notificações** pede autorização do navegador e avisa sobre novos eventos via Supabase Realtime, com consulta periódica de apoio enquanto a página está aberta.
- Notificações do navegador enquanto o site está totalmente fechado exigem um serviço Web Push (service worker, VAPID e um emissor no servidor); esse envio fora da página não está incluído nesta versão, pois requer credenciais e configuração de servidor que não vieram nos arquivos originais.

## Compatibilidade de banco

O projeto espera a tabela `public.events` com os campos usados anteriormente (`id`, `name`, `description`, `image`, `date`, `category`, `has_ticket`, `price`, `link`) e a tabela `public.admins` com `email`, `created_at` e, para registrar quem adicionou um administrador, `added_by`. A migração adiciona `end_date`. Não substitua as suas policies do Supabase por policies públicas permissivas.

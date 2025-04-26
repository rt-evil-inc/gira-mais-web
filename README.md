Este repositório contém a página web relativa à aplicação Gira+. Através desta plataforma, é possível visualizar estatísticas detalhadas relativas à utilização da aplicação.

## Execução com Docker Compose

Para executar a aplicação utilizando Docker Compose:

1. Descarregar o ficheiro `docker-compose.yml`:
   ```bash
    curl -O https://raw.githubusercontent.com/rt-evil-inc/gira-web/main/docker-compose.yml
   ```

2. Configurar as variáveis de ambiente no ficheiro `docker-compose.yml`:
   - Alterar `ADMIN_LOGIN=admin:password` para as credenciais de administrador desejadas
   - Ajustar `INITIAL_DATE` conforme necessário
   - Alterar as credenciais da base de dados se desejado

3. Iniciar os containers:
   ```bash
   docker-compose up -d
   ```

Para parar a aplicação:
```bash
docker-compose down
```

## Desenvolvimento Local

Para executar a aplicação em modo de desenvolvimento:

1. Clonar este repositório:
   ```bash
   git clone https://github.com/rt-evil-inc/gira-web.git
   cd gira-web
   ```

2. Configurar as variáveis de ambiente:
   - Copiar o ficheiro `.env.example` para `.env`
   - Ajustar as variáveis conforme necessário

3. Instalar as dependências:
   ```bash
   bun install
   ```

4. Iniciar a base de dados PostgreSQL:
   ```bash
   bun db:start
   ```

5. Executar as migrações da base de dados:
   ```bash
   bun db:push
   ```

6. Iniciar o servidor de desenvolvimento:
   ```bash
   bun dev
   ```

## Scripts Disponíveis

- `bun dev` - Inicia o servidor de desenvolvimento
- `bun build` - Compila a aplicação para produção
- `bun preview` - Visualiza a versão de produção localmente
- `bun db:start` - Inicia a base de dados PostgreSQL
- `bun db:push` - Actualiza o esquema da base de dados
- `bun db:migrate` - Executa migrações da base de dados
- `bun db:studio` - Inicia uma interface para gestão da base de dados

## Variáveis de Ambiente

- `DATABASE_URL` - URI de ligação à base de dados PostgreSQL
- `ADMIN_LOGIN` - Credenciais de administrador no formato `utilizador:password`
- `NODE_ENV` - Ambiente de execução (`development` ou `production`)
- `INITIAL_DATE` - Data inicial para os dados estatísticos

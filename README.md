# TIPO UBER API

No intuito de facilitar a imerção de novos membros no desenvolvimento da api de mobilidade(tipo uber), 
este README irá fornecer um walkthrough inicial de conhecimentos gerais sobre o projeto e sobre o desenvolvimento.

# Sumário

- [Sobre](#sobre)
- [Instalação](#instalação)
- [Guia de desenvolvimento](#desenvolvimento)
    - [Merge Request](#merge-request)
    - [Feature](#feature)
    - [Bug Fix](#bug-fix)
    - [Hot Fix](#hot-fix)
    - [Padrões de escrita](#padrões-de-escrita)
- [Tecnologias utilizadas](#tecnologias-utilizadas)
- [Colaboradores atuais](#colaboradores-atuais)
- [Copyright](#copyright)



### Sobre

A api de mobilidade é o backend dos aplicativos de mobilidade urbana, este projeto serve 
gere a comunicação e logica dos aplicativos ios e android tanto profissional(motorista) quanto do cliente(passageiro) além da interface web ou dashboard.

Este projeto atende a todos os aplicativos de mobilidade sendo configurado de acordo com as necessidades de cada projeto através dos arquivos de configuração do ambiente, um guia do mesmo pode ser encontrado em(https://wiki.usemobile.com.br//backend/arquivo-de-configuracao-para-tipo-uber)  que devem estar situados na pasta config na raiz do projeto

## Instalação
https://wiki.usemobile.com.br//backend/configurar-ec-2

## Desenvolvimento

O desenvolvimento dentro do projeto segue muitos conceitos e fluxos do [Gitflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) para facilitar o fluxo de desenvolvimento utilizamos o plugin do webstorm (gitflow).

### Merge Request

O objetivo da prática do Merge Request é:

- assegurar uma conhecimento mais amplo do que está sendo implementado e corrigido no projeto dentre os colaboradores. 
- diminuir injeção de bugs dentro da aplicação.
- reduzir códigos duplicados.
- respeitar o guia de estilo proposto para desenvolvimento.

### Feature

Novas funcionalidades seguem as etapas:

Quando designada uma tarefa, o responsável deverá seguir as seguintes etapas:

- abrir nova branch a partir da `master`.
- implementar feature.
- fazer merge da feature com a branch homolog. 
- verificar o resultado dos testes. 
- abrir MR para a master. 

### Bug Fix

Quando designada uma correção, o responsável deverá seguir as seguintes etapas:

- abrir nova branch a partir da `master`.
- realizar correções.
- fazer merge da feature com a branch homolog. 
- verificar o resultado dos testes.
- abrir MR para a master.

### Hot Fix

Correções em ambiente de produção podem surgir a qualquer momento. Essas correções são passadas, geralmente, pelo PO ou pelo cliente. Para realização dessa tarefa, deve-se seguir as seguintes etapas:

- abrir nova branch a partir da `production`.
- realizar correções.
- finalizar o hotfix(nesta etapa é feito merge do hotfix para master e production)
- realizar o deploy da aplicação

### Release

As releases devem sair da branch master para production e devem marcadas com a tag sugerida pelo gitflow especificando as features e bugfix presentes.

### Padrões de escrita

Para nomeação de branches.

| Branch           | Exemplo                                 |
|-----------------|----------------------------------|
| Nova feature  | feature/nomeDaFeature                  |
| Bug Fix          | bugfix/nomeDoFix  |
| Hot Fix           | hotfix/nomeDoHotfix          |
| Release          | release/nomeDoRelease          |

Para mensagens de commit. Todas as mensagens devem estar em <strong>inglês</strong>! A mensagem deve ser clara e objetiva,
 lembre-se outras pessoas usam o git. Além disso devem seguir o seguinte guideline.
 
| Marcação           | Exemplo                                               |
|--------------------|-------------------------------------------------------|
| Add                    | [Add] New checkbox layout.                              |
| Fix                      | [Fix] English error message shown to user.        |
| Update               | [Update] Button highlight state.                         |
| Remove              | [Remove] Disabled feature alert.                        | 
| Test              | [Test] adding new test scenario.                        | 


Para tags.

Tags são utilizadas nas branches de release e seguem o padrão sugerido pelo plugin gitflow
                                                          

## Tecnologias utilizadas
    - Parse 1.8.0 (framework)
    - firebase latest (real time database)
    - express 4.11.x (libbrary to process hooks)
    - mongodb latest (NoSQL database)
    - redis latest (volatile memory database)
    - postgresql latest (relational database)
    - jest latest
## Colaboradores atuais

* Ana Luiza Moraes. <ana.moraes@usemobile.xyz>

* Axel Andrade. <axel.andrade@usemobile.xyz>

* Mateus Freire Carneiro. <mateus.freire@usemobile.xyz>




## Copyright

© 2016-2020 Usemobile. Todos os direitos reservados.

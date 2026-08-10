-- Pendência #5 da auditoria: "Onde a implementação trava" não é monotônico.
--
-- Os números estão certos — Ferramentas 3.244 · Materiais 1.698 · Vídeo 1.643 ·
-- Checklist 343 · Comentários 835 · Conclusão 831 — mas eram servidos como
-- funil, e aí Checklist em 10,6% entre Vídeo (50,7%) e Comentários (25,7%) só
-- pode ser lido como erro de cálculo.
--
-- As abas de implementação não são etapas com porteiro: dá para concluir
-- Comentários sem passar pelo Checklist. Logo não é funil, é conclusão por aba,
-- e Checklist baixo significa ABA PULADA — que é justamente o achado útil, e
-- ficava escondido atrás da suspeita de bug.
--
-- Nome de função e de coluna mudam junto: "funil" e "pct_do_topo" são o que
-- induzem a leitura errada em quem for mexer nisso depois.
drop function if exists public.bi_solucoes_funil_abas();

create function public.bi_solucoes_conclusao_por_aba()
returns table(aba text, ordem integer, usuarios bigint, pct_da_maior_aba numeric)
language sql
stable
set search_path to ''
as $function$
  with por_aba as (
    select a.aba, count(distinct a.user_id) as usuarios
    from marts.fact_aba_implementacao a
    join marts.dim_usuario u on u.user_id = a.user_id and u.e_cliente
    where a.concluida_em is not null
    group by a.aba
  ),
  ordenado as (
    select * from (values
      ('tools', 1, 'Ferramentas'),
      ('resources', 2, 'Materiais'),
      ('video', 3, 'Vídeo'),
      ('checklist', 4, 'Checklist'),
      ('comments', 5, 'Comentários'),
      ('completion', 6, 'Conclusão')
    ) as o(aba, ordem, rotulo)
  ),
  -- base = a aba mais concluída, não "o topo do funil": é régua de comparação
  -- entre abas independentes, não ponto de partida de uma sequência
  maior as (select max(usuarios) as usuarios from por_aba)
  select o.rotulo, o.ordem, coalesce(p.usuarios, 0),
         round(coalesce(p.usuarios, 0)::numeric / nullif((select usuarios from maior), 0), 4)
  from ordenado o
  left join por_aba p on p.aba = o.aba
  order by o.ordem;
$function$;

comment on function public.bi_solucoes_conclusao_por_aba() is
  'Usuários únicos que concluíram cada aba de implementação, na ordem temporal típica de uso. Não é funil: as abas são independentes, então valor baixo indica aba pulada, não abandono.';

grant execute on function public.bi_solucoes_conclusao_por_aba() to authenticated;

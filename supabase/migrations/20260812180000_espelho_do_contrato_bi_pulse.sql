-- Espelho das 8 views do contrato bi_pulse do Pulse.
--
-- LIMIT TO explicito, nunca import do schema inteiro: e a trava que garante que
-- so entra o que foi negociado. O role bi_pulse_readonly ja nao alcanca `public`
-- (onde mora texto de conversa, e-mail e telefone), mas a lista aqui e a segunda
-- parede -- se um dia alguem ampliar o grant la, isto continua segurando.
import foreign schema bi_pulse
  limit to (
    atendimento_tickets,
    cancelamentos,
    disparos_avulsos,
    disparos_campanhas,
    disparos_destinatarios,
    pipeline_cards,
    pipeline_movimentos,
    retencao
  )
  from server pulse_srv into pulse;

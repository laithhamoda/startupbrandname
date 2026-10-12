import type { EngineRun } from '@sbn/engine';
import {
  buildBusinessModelCanvas,
  buildLeanCanvas,
  type CanvasBlock,
  type CanvasInput,
  type CanvasKind,
  type CanvasModel,
} from '../../canvas';
import { isPivotalStep, type Ctx } from '../context';
import { labelOfCurrency } from '../format';
import { plain } from '../inline';
import type { Block, CanvasCellModel } from '../types';
import { paragraph } from './shared';

function cellOf(ctx: Ctx, run: EngineRun, block: CanvasBlock): CanvasCellModel {
  const { m } = ctx;
  const { fixedCosts, variableCost, setupCosts } = run.input;
  const totals =
    block.id === 'costStructure'
      ? [
          {
            label: plain(m.canvases.totals.fixedMonthly),
            value: ctx.moneyCell(fixedCosts, { pivotal: true }),
          },
          {
            label: plain(m.canvases.totals.variableUnit),
            value: ctx.moneyCell(variableCost, { pivotal: true }),
          },
          ...(setupCosts === null
            ? []
            : [
                {
                  label: plain(m.canvases.totals.setup),
                  value: ctx.moneyCell(setupCosts, { pivotal: true }),
                },
              ]),
        ]
      : [];
  return {
    id: block.id,
    title: m.canvases.blocks[block.id],
    chips: block.chips.map((chip) => ({
      key: chip.key,
      questionId: chip.questionId,
      label: chip.label,
      text: chip.text,
      provenance: chip.provenance,
      lowConfidence: isPivotalStep(chip.questionId) && chip.provenance.confidence === 'low',
    })),
    empty: block.reason === null ? null : plain(m.canvases.empty[block.reason]),
    totals,
  };
}

function canvasBlock(ctx: Ctx, run: EngineRun, kind: CanvasKind, model: CanvasModel): Block {
  return {
    type: 'canvas',
    kind,
    title: ctx.m.canvases.names[kind],
    blocks: model.blocks.map((block) => cellOf(ctx, run, block)),
  };
}

/** The Business Model Canvas and the Lean Canvas, with the provenance of every chip (T1, T2). */
export function buildCanvases(ctx: Ctx, run: EngineRun): Block[] {
  const { input } = ctx;
  const canvasInput: CanvasInput = {
    language: ctx.locale,
    answers: input.answers,
    provenance: input.provenance,
    currencyLabel: (code) => labelOfCurrency(code, input.project),
  };
  return [
    paragraph(plain(ctx.m.canvases.intro)),
    canvasBlock(ctx, run, 'business_model', buildBusinessModelCanvas(canvasInput)),
    canvasBlock(ctx, run, 'lean', buildLeanCanvas(canvasInput)),
  ];
}

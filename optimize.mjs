import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, textureCompress, dedup, resample, prune, weld, instance } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const files = [
    { in: 'public/assets/watertiles/Meshy_AI_Level_1_Floating_Lotu_0315175149_texture.glb', out: 'public/assets/watertiles/watertile_lv1.glb' },
    { in: 'public/assets/watertiles/Meshy_AI_Water_level_2_0315175111_texture.glb', out: 'public/assets/watertiles/watertile_lv2.glb' },
    { in: 'public/assets/watertiles/Meshy_AI_Water_level_3_Lilypad_0315175140_texture.glb', out: 'public/assets/watertiles/watertile_lv3.glb' },
    { in: 'public/assets/watertiles/Meshy_AI_Water_level_4_Verdant_0315175131_texture.glb', out: 'public/assets/watertiles/watertile_lv4.glb' },
    { in: 'public/assets/watertiles/Meshy_AI_Water_level_5_Azure_O_0315175120_texture.glb', out: 'public/assets/watertiles/watertile_lv5.glb' }
];

async function optimize() {
    await MeshoptSimplifier.ready;

    for (const file of files) {
        if (!fs.existsSync(file.in)) continue;
        console.log(`Processing ${file.in}...`);
        const document = await io.read(file.in);

        await document.transform(
            // Deduplicate vertex attributes
            dedup(),
            // Prune unused nodes
            prune(),
            // Weld vertices (helps simplify)
            weld(),
            // Moderate simplify (down to 15% of original geometry, lower error tolerance)
            simplify({ simplifier: MeshoptSimplifier, ratio: 0.15, error: 0.01 }),
            // Texture compression and tight resize
            textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [128, 128] })
        );

        await io.write(file.out, document);

        const size = fs.statSync(file.out).size / 1024 / 1024;
        console.log(`Saved ${file.out} (${size.toFixed(2)} MB)`);
    }
}

optimize().catch(e => console.error(e));

// Aligne la cible iOS de chaque Pod sur celle de l'app, quand elle est plus
// basse. Avec Xcode 27, une cible sous 15.0 est une erreur (SDWebImage, RNSVG),
// et un Pod compilé pour 15.1 ne peut pas appeler une API iOS 16 (expo-router).
// La cible de l'app vient d'expo-build-properties (`ios.deploymentTarget` dans
// app.json), lue ici dans Podfile.properties.json : une seule source de vérité.
// Le Podfile est généré par `prebuild`, d'où un config plugin plutôt qu'une
// modification à la main dans `ios/`.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = '# with-pods-deployment-target';
const ANCHOR = 'post_install do |installer|';

const SNIPPET = `
    ${MARKER}
    app_target = podfile_properties['ios.deploymentTarget'] || '15.1'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        if build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < app_target.to_f
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = app_target
        end
      end
    end`;

module.exports = function withPodsDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'Podfile',
      );
      const podfile = fs.readFileSync(podfilePath, 'utf8');

      if (!podfile.includes(MARKER)) {
        if (!podfile.includes(ANCHOR)) {
          throw new Error(
            `with-pods-deployment-target: "${ANCHOR}" introuvable dans le Podfile`,
          );
        }
        fs.writeFileSync(
          podfilePath,
          podfile.replace(ANCHOR, `${ANCHOR}${SNIPPET}`),
        );
      }
      return modConfig;
    },
  ]);
};

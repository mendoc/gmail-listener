#!/bin/sh
#
# Copyright 2024 Dimitri ONGOUA. All Rights Reserved.
#

echo Téléchargement de Google Cloud CLI
curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-460.0.0-linux-x86_64.tar.gz

echo Installation de Google Cloud CLI
./google-cloud-sdk/install.sh

echo Initialisation de Google Cloud CLI
./google-cloud-sdk/bin/gcloud init